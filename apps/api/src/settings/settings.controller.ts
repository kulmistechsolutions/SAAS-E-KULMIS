import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
} from "@nestjs/common";
import { updateSettingsSchema, UserRole, type TenantContext } from "@ekulmis/shared";
import { SettingsService } from "./settings.service";
import { Public } from "../auth/public.decorator";
import { Roles } from "../auth/roles.decorator";
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

  /** Full settings (any authenticated user in the tenant). */
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
}
