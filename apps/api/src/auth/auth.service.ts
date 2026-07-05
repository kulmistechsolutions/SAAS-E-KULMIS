import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { verifyPassword } from "./password.util";
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
    return this.issueTokens(user);
  }

  /** Rotate a refresh token: revoke the old one, issue a fresh pair. */
  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    if (existing.user.status !== "ACTIVE") {
      throw new UnauthorizedException("User is not active");
    }
    return this.issueTokens(existing.user);
  }

  /** Revoke a refresh token (logout). */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      sid: user.schoolId,
      role: user.role,
      username: user.username,
    };
    const accessToken = await this.jwt.signAsync(payload);

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
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        schoolId: user.schoolId,
      },
    };
  }

  private hashToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}
