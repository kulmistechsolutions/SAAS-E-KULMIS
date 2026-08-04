import { Controller, Get } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { DashboardService } from "./dashboard.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // Every non-teacher staff role lands here after login (DashboardPage only
  // special-cases TEACHER) — restricting this to ADMINISTRATOR left every
  // other role (Finance Officer, Attendance Officer, Exam Manager, ...)
  // staring at "Could not reach the dashboard API" on their very first
  // screen. Everything returned is an aggregate count/sum (totals, not
  // individual salary/fee records), so it's safe for any signed-in staff
  // member the same way Settings reads already are.
  @Roles(...STAFF_ROLES)
  @Get("admin")
  admin(@CurrentUser() me: AuthUser) {
    return this.dashboard.admin(me.schoolId);
  }

  @Roles(UserRole.TEACHER)
  @Get("teacher")
  teacher(@CurrentUser() me: AuthUser) {
    return this.dashboard.teacher(me.schoolId, me.userId);
  }
}
