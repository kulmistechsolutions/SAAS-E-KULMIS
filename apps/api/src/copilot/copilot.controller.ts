import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { UserRole } from "@ekulmis/shared";
import { CopilotService } from "./copilot.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { RequirePermission } from "../auth/require-permission.decorator";

const askSchema = z.object({
  question: z.string().min(3).max(500),
  /** Which language to answer in — the one the asker is reading the system in. */
  locale: z.enum(["en", "so", "ar"]).optional(),
});

/** Read-only. Management sees the school; nobody else needs the whole picture. */
@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.ACADEMIC_MANAGER)
@Controller("copilot")
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @RequirePermission("finance.view", "academics.view")
  @Get("overview")
  overview(@CurrentUser() me: AuthUser, @Query("month") month?: string) {
    return this.copilot.overview(me.schoolId, month);
  }

  @RequirePermission("finance.view", "academics.view")
  @Get("students")
  students(@CurrentUser() me: AuthUser, @Query("limit") limit?: string) {
    return this.copilot.students(me.schoolId, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @RequirePermission("finance.view", "academics.view")
  @Get("risks")
  risks(@CurrentUser() me: AuthUser, @Query("month") month?: string) {
    return this.copilot.risks(me.schoolId, month);
  }

  /** The written summary. Degrades to the figures alone when AI is off. */
  @RequirePermission("finance.view", "academics.view")
  @Get("brief")
  brief(
    @CurrentUser() me: AuthUser,
    @Query("month") month?: string,
    @Query("locale") locale?: string,
  ) {
    return this.copilot.brief(me.schoolId, month, locale);
  }

  @RequirePermission("finance.view", "academics.view")
  @Get("quota")
  quota(@CurrentUser() me: AuthUser) {
    return this.copilot.quota(me.schoolId);
  }

  @RequirePermission("finance.view", "academics.view")
  @Get("history")
  history(@CurrentUser() me: AuthUser) {
    return this.copilot.history(me.schoolId);
  }

  @RequirePermission("finance.view", "academics.view")
  @Post("ask")
  ask(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = askSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.copilot.ask(me.schoolId, parsed.data.question, {
      userId: me.userId,
      username: me.username,
      locale: parsed.data.locale,
    });
  }
}
