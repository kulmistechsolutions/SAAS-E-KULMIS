import { Controller, Get, Query } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { FinanceService } from "./finance.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
@Controller("finance")
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  /** `?month=YYYY-MM` scopes every total to that month; omit it for all time. */
  @Get("dashboard")
  dashboard(@CurrentUser() me: AuthUser, @Query("month") month?: string) {
    return this.finance.dashboard(me.schoolId, month);
  }
}
