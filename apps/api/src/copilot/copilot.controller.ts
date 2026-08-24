import { Controller, Get, Query } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { CopilotService } from "./copilot.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/** Read-only. Management sees the school; nobody else needs the whole picture. */
@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.ACADEMIC_MANAGER)
@Controller("copilot")
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Get("overview")
  overview(@CurrentUser() me: AuthUser, @Query("month") month?: string) {
    return this.copilot.overview(me.schoolId, month);
  }

  @Get("students")
  students(@CurrentUser() me: AuthUser, @Query("limit") limit?: string) {
    return this.copilot.students(me.schoolId, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("risks")
  risks(@CurrentUser() me: AuthUser, @Query("month") month?: string) {
    return this.copilot.risks(me.schoolId, month);
  }
}
