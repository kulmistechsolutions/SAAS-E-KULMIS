import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import type { PlatformAdmin } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { verifyPassword } from "../auth/password.util";
import type { PlatformJwtPayload } from "./platform.types";

function parseDurationMs(value: string): number {
  const m = /^(\d+)([smhd])$/.exec(value.trim());
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]!]!;
  return n * unit;
}

/** Authentication for platform Super Admins (separate from school users). */
@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { username },
    });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.issueTokens(admin);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hash(refreshToken);
    const existing = await this.prisma.platformRefreshToken.findUnique({
      where: { tokenHash },
      include: { admin: true },
    });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    await this.prisma.platformRefreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(existing.admin);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hash(refreshToken);
    await this.prisma.platformRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(admin: PlatformAdmin) {
    const payload: PlatformJwtPayload = {
      sub: admin.id,
      platform: true,
      username: admin.username,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const raw = randomBytes(32).toString("hex");
    const ttlMs = parseDurationMs(
      this.config.get<string>("JWT_REFRESH_TTL") ?? "7d",
    );
    await this.prisma.platformRefreshToken.create({
      data: {
        adminId: admin.id,
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return {
      accessToken,
      refreshToken: raw,
      admin: { id: admin.id, username: admin.username, name: admin.name },
    };
  }

  private hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}
