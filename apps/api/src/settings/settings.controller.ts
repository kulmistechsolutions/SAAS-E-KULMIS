import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import {
  updateSettingsSchema,
  uploadSchoolLogoSchema,
  UserRole,
  type TenantContext,
} from "@ekulmis/shared";
import { SettingsService } from "./settings.service";
import { assertSchoolLogoMime } from "./school-logo.util";
import { Public } from "../auth/public.decorator";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentTenant } from "../tenant/current-tenant.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Public branding for the tenant's login page (resolved by subdomain). */
  @Public()
  @Get("branding")
  branding(@CurrentTenant() tenant: TenantContext) {
    return this.settings.getBranding(tenant.schoolId);
  }

  /**
   * Public logo bytes — used when the storage backend has no direct URL
   * (local filesystem). `<img>` tags can't send the tenant header, so the
   * tenant middleware also accepts `?tenant=<subdomain>` for this route.
   */
  @Public()
  @Get("logo")
  async logo(@CurrentTenant() tenant: TenantContext, @Res() res: Response) {
    const { buffer, contentType } = await this.settings.getLogoFile(tenant.schoolId);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(buffer);
  }

  /** Full settings — staff only (portal roles read branding via /branding). */
  @Roles(...STAFF_ROLES)
  @Get()
  get(@CurrentUser() me: AuthUser) {
    return this.settings.get(me.schoolId);
  }

  /** Update settings — administrators only. */
  @Roles(UserRole.ADMINISTRATOR)
  @Patch()
  update(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.settings.update(me.schoolId, parsed.data);
  }

  /** Upload/replace the school logo — administrators only. */
  @Roles(UserRole.ADMINISTRATOR)
  @Post("logo")
  async uploadLogo(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = uploadSchoolLogoSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const mime = assertSchoolLogoMime(parsed.data.mimeType);
    const buffer = Buffer.from(parsed.data.file, "base64");
    return this.settings.uploadLogo(me.schoolId, buffer, mime);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete("logo")
  removeLogo(@CurrentUser() me: AuthUser) {
    return this.settings.removeLogo(me.schoolId);
  }
}
