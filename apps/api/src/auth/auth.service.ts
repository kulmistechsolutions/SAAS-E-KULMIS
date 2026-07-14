import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword, verifyPassword } from "./password.util";
import type { JwtPayload } from "./auth.types";

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
  ) {}

  /** Authenticate within a tenant (schoolId) by username + password. */
  async login(schoolId: string, username: string, password: string) {
    // System-level lookup (runs as the privileged connection, bypassing RLS).
    const user = await this.prisma.user.findUnique({
      where: { schoolId_username: { schoolId, username } },
    });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user);
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

  private signAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      sid: user.schoolId,
      role: user.role,
      username: user.username,
    };
    return this.jwt.signAsync(payload);
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
    const ttlMs = parseDurationMs(this.config.get<string>("JWT_REFRESH_TTL") ?? "7d");
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
