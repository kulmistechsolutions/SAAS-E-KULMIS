import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
} from "@nestjs/common";
import { loginSchema, type TenantContext } from "@ekulmis/shared";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { Public } from "./public.decorator";
import { CurrentTenant } from "../tenant/current-tenant.decorator";
import type { AuthUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Login within the tenant resolved from the subdomain. */
  @Public()
  @Post("login")
  async login(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: unknown,
  ) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.auth.login(
      tenant.schoolId,
      parsed.data.identifier,
      parsed.data.password,
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
}
