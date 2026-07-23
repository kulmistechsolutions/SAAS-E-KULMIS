import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import {
  changePasswordSchema,
  loginSchema,
  type TenantContext,
} from "@ekulmis/shared";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { Public } from "./public.decorator";
import { CurrentTenant } from "../tenant/current-tenant.decorator";
import type { AuthUser } from "./auth.types";

/** Real client address behind Traefik, falling back to the socket address. */
function clientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0];
  return (first ?? req.ip ?? null)?.trim() || null;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Login within the tenant resolved from the subdomain.
   *
   * Throttled hard: 10 attempts per minute per IP. A real person signing in
   * never comes close; a script working through a password list is stopped
   * dead. Every attempt — successful or not — is written to the audit trail.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post("login")
  async login(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.auth.login(
      tenant.schoolId,
      parsed.data.identifier,
      parsed.data.password,
      { ip: clientIp(req), userAgent: req.headers["user-agent"] ?? null },
    );
  }

  @Public()
  @Post("refresh")
  async refresh(@Body() body: { refreshToken?: string }) {
    if (!body?.refreshToken) {
      throw new BadRequestException("refreshToken is required");
    }
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  async logout(@Body() body: { refreshToken?: string }) {
    if (body?.refreshToken) {
      await this.auth.logout(body.refreshToken);
    }
    return { success: true };
  }

  /** Returns the authenticated principal (requires a valid access token). */
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post("change-password")
  @HttpCode(200)
  async changePassword(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.auth.changePassword(
      user.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    return { success: true };
  }
}
