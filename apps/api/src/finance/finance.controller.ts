import { Controller, Get } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { FinanceService } from "./finance.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
@Controller("finance")
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() me: AuthUser) {
    return this.finance.dashboard(me.schoolId);
  }
}
