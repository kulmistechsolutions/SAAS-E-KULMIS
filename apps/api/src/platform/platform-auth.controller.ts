import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import { loginSchema } from "@ekulmis/shared";
import { PlatformAuthService } from "./platform-auth.service";
import { PlatformGuard } from "./platform.guard";
import { CurrentPlatformAdmin } from "./current-platform-admin.decorator";
import type { PlatformAdminCtx } from "./platform.types";
import { Public } from "../auth/public.decorator";

/** Super Admin authentication — completely separate from school login. */
@Public()
@Controller("platform/auth")
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Post("login")
  async login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.auth.login(parsed.data.identifier, parsed.data.password);
  }

  @Post("refresh")
  refresh(@Body() body: { refreshToken?: string }) {
    if (!body?.refreshToken) {
      throw new BadRequestException("refreshToken is required");
    }
    return this.auth.refresh(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Body() body: { refreshToken?: string }) {
    if (body?.refreshToken) await this.auth.logout(body.refreshToken);
    return { success: true };
  }

  @UseGuards(PlatformGuard)
  @Get("me")
  async me(@CurrentPlatformAdmin() admin: PlatformAdminCtx) {
    const row = await this.auth.getAdminProfile(admin.adminId);
    return row ?? {
      adminId: admin.adminId,
      username: admin.username,
      role: admin.role,
    };
  }
}
