import { Controller, Get } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { DashboardService } from "./dashboard.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Roles(UserRole.ADMINISTRATOR)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("admin")
  admin(@CurrentUser() me: AuthUser) {
    return this.dashboard.admin(me.schoolId);
  }
}
