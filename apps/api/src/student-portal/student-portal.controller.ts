import { BadRequestException, Body, Controller, Get, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { studentPortalLoginSchema, UserRole } from "@ekulmis/shared";
import type { TenantContext } from "@ekulmis/shared";
import { StudentPortalService } from "./student-portal.service";
import { Public } from "../auth/public.decorator";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentTenant } from "../tenant/current-tenant.decorator";
import type { AuthUser } from "../auth/auth.types";

/**
 * Student-facing portal — separate from the staff `/students` controller.
 * Only reachable when the school has turned it on (School.studentPortalEnabled).
 */
@Controller("student-portal")
export class StudentPortalController {
  constructor(private readonly portal: StudentPortalService) {}

  @Public()
  @Post("login")
  login(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = studentPortalLoginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.portal.login(tenant.schoolId, parsed.data);
  }

  @Roles(UserRole.STUDENT)
  @Get("me")
  me(@CurrentUser() me: AuthUser) {
    return this.portal.me(me.schoolId, me.userId);
  }

  @Roles(UserRole.STUDENT)
  @Get("attendance")
  attendance(@CurrentUser() me: AuthUser) {
    return this.portal.attendance(me.schoolId, me.userId);
  }

  @Roles(UserRole.STUDENT)
  @Get("fees")
  fees(@CurrentUser() me: AuthUser) {
    return this.portal.feesLedger(me.schoolId, me.userId);
  }

  @Roles(UserRole.STUDENT)
  @Get("results")
  results(@CurrentUser() me: AuthUser) {
    return this.portal.results(me.schoolId, me.userId);
  }

  @Roles(UserRole.STUDENT)
  @Get("photo")
  async photo(@CurrentUser() me: AuthUser, @Res() res: Response) {
    const { buffer, contentType } = await this.portal.photo(me.schoolId, me.userId);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buffer);
  }

  @Roles(UserRole.STUDENT)
  @Get("timetable")
  timetable(@CurrentUser() me: AuthUser) {
    return this.portal.timetableForStudent(me.schoolId, me.userId);
  }

  @Roles(UserRole.STUDENT)
  @Get("quizzes")
  quizzes(@CurrentUser() me: AuthUser) {
    return this.portal.quizzes(me.schoolId, me.userId);
  }
}
