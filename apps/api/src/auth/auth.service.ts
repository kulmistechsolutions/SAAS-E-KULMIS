import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { AuditService } from "../audit/audit.service";
import { hashPassword, verifyPassword } from "./password.util";
import { PasswordPolicyService } from "../settings/password-policy.service";
import type { JwtPayload } from "./auth.types";

/** Where a sign-in attempt came from, recorded on every attempt. */
export interface LoginContext {
  ip?: string | null;
  userAgent?: string | null;
}

/** Audit module/actions for the sign-in trail. */
const AUTH_MODULE = "auth";
const LOGIN_OK = "LOGIN";
const LOGIN_FAILED = "LOGIN_FAILED";

/** Parses simple durations like "15m", "7d", "12h", "30s" into milliseconds. */
function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const n = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]!]!;
  return n * unit;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly subscriptions: SubscriptionsService,
    private readonly audit: AuditService,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  /**
   * Authenticate within a tenant (schoolId) by username + password.
   *
   * Every attempt is written to the audit trail — success and failure alike —
   * so a school owner can see who signed in and when, and a run of failures
   * against one account is visible rather than silent. The response is the same
   * "Invalid credentials" either way, so the trail never leaks which usernames
   * exist.
   */
  async login(
    schoolId: string,
    username: string,
    password: string,
    ctx: LoginContext = {},
  ) {
    // System-level lookup (runs as the privileged connection, bypassing RLS).
    const user = await this.prisma.user.findUnique({
      where: { schoolId_username: { schoolId, username } },
    });
    if (!user || user.status !== "ACTIVE") {
      await this.recordLoginFailure(schoolId, username, ctx, {
        reason: user ? `account ${user.status}` : "unknown user",
      });
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await this.recordLoginFailure(schoolId, username, ctx, {
        reason: "wrong password",
        userId: user.id,
        role: user.role,
      });
      throw new UnauthorizedException("Invalid credentials");
    }
    // Checked after the password so a wrong password can never reveal a
    // school's billing state.
    //
    // A lapsed subscription used to end here, with "please contact Platform
    // Administrator". The screen that sells a plan sits behind sign-in, so the
    // one thing that would fix the situation was the one thing the school
    // could not reach, and every renewal became a phone call. An administrator
    // now gets a token scoped to billing and nothing else, so they can choose
    // a plan and pay for it themselves; the moment the payment clears, the
    // ordinary sign-in works again.
    //
    // Only an administrator, because only an administrator can buy anything.
    // A teacher meeting a lapsed plan still gets the refusal — with something
    // they can act on, which is to tell their administrator.
    const access = await this.subscriptions.schoolAccess(schoolId);
    if (!access.allowed) {
      const canRenew =
        user.role === "ADMINISTRATOR" || user.role === "SUPER_ADMINISTRATOR";
      await this.audit.record({
        schoolId,
        userId: user.id,
        username: user.username,
        role: user.role,
        module: AUTH_MODULE,
        action: canRenew ? "Renewal Session Issued" : LOGIN_FAILED,
        ip: ctx.ip ?? null,
        metadata: {
          reason: `subscription ${access.reason}`,
          userAgent: ctx.userAgent ?? null,
        },
      });
      if (!canRenew) {
        throw new ForbiddenException(
          `${access.message ?? "Your school subscription has expired."} Ask your school administrator to renew it.`,
        );
      }
      return {
        renewal: true as const,
        accessToken: await this.signBillingToken(user),
        access,
        user: this.userSummary(user),
      };
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record({
      schoolId,
      userId: user.id,
      username: user.username,
      role: user.role,
      module: AUTH_MODULE,
      action: LOGIN_OK,
      ip: ctx.ip ?? null,
      metadata: { userAgent: ctx.userAgent ?? null },
    });
    return this.issueTokens(user);
  }

  /** One failed sign-in, recorded with why it failed (never shown to callers). */
  private async recordLoginFailure(
    schoolId: string,
    username: string,
    ctx: LoginContext,
    detail: { reason: string; userId?: string; role?: User["role"] },
  ): Promise<void> {
    await this.audit.record({
      schoolId,
      userId: detail.userId ?? null,
      username,
      role: detail.role ?? null,
      module: AUTH_MODULE,
      action: LOGIN_FAILED,
      ip: ctx.ip ?? null,
      metadata: { reason: detail.reason, userAgent: ctx.userAgent ?? null },
    });
  }

  /**
   * Issue a fresh access token from a refresh token WITHOUT rotating the
   * refresh token. Rotating on every call (revoke old + issue new) created a
   * race: a client that fires several requests in parallel (e.g. the teacher
   * portal loading profile + permissions + dashboard at once) triggers
   * overlapping refreshes; the second one presents a token the first already
   * revoked, gets 401, and the app force-logs-out to /login. Reusing the same
   * refresh token until it expires makes concurrent refreshes idempotent.
   */
  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt < new Date() ||
      existing.user.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const accessToken = await this.signAccessToken(existing.user);
    return {
      accessToken,
      refreshToken,
      user: this.userSummary(existing.user),
    };
  }

  /** Revoke a refresh token (logout). */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * A token that can pay for a plan and do nothing else.
   *
   * Thirty minutes, because it exists for one transaction and a credential
   * that outlives its purpose is a credential somebody finds later. It carries
   * no refresh token for the same reason \u2014 renewing it would mean renewing
   * the right to spend without signing in again.
   *
   * What it may reach is decided by @BillingScope() on the route, not here;
   * JwtAuthGuard refuses it everywhere else.
   */
  private async signBillingToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      sid: user.schoolId,
      role: user.role,
      username: user.username,
      scope: "BILLING",
      ...(user.customRoleId ? { crid: user.customRoleId } : {}),
    };
    return this.jwt.signAsync(payload, { expiresIn: 30 * 60 });
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      sid: user.schoolId,
      role: user.role,
      username: user.username,
      ...(user.customRoleId ? { crid: user.customRoleId } : {}),
    };
    const minutes = await this.getSessionTimeoutMinutes(user.schoolId);
    return this.jwt.signAsync(payload, { expiresIn: minutes * 60 });
  }

  /**
   * A school can shorten/lengthen how long its staff stay signed in
   * (Settings → Security). Null keeps the platform default (JWT_ACCESS_TTL).
   * Also handed to the frontend (via /auth/me) so its idle-activity timer can
   * log a user out the moment they've been inactive this long, instead of
   * silently staying signed in via reactive refresh-on-401.
   */
  async getSessionTimeoutMinutes(schoolId: string): Promise<number> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { sessionTimeoutMinutes: true },
    });
    if (school?.sessionTimeoutMinutes) return school.sessionTimeoutMinutes;
    const ttlMs = parseDurationMs(
      this.config.get<string>("JWT_ACCESS_TTL") ?? "15m",
    );
    return Math.max(1, Math.round(ttlMs / 60_000));
  }

  private userSummary(user: User) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      schoolId: user.schoolId,
    };
  }

  private async issueTokens(user: User) {
    const accessToken = await this.signAccessToken(user);

    const raw = randomBytes(32).toString("hex");
    const ttlMs = parseDurationMs(
      this.config.get<string>("JWT_REFRESH_TTL") ?? "7d",
    );
    await this.prisma.refreshToken.create({
      data: {
        schoolId: user.schoolId,
        userId: user.id,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return {
      accessToken,
      refreshToken: raw,
      user: this.userSummary(user),
    };
  }

  /** Authenticated user changes their own password. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException("Current password is incorrect");
    }
    await this.passwordPolicy.assertAllowed(user.schoolId, newPassword);
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}
