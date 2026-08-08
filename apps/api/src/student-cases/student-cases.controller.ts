import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { createStudentCaseSchema, UserRole } from "@ekulmis/shared";
import { StudentCasesService } from "./student-cases.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/**
 * Student Cases — behavior/discipline notes attached to a student. Any staff
 * role can read (needed for the profile tab / dashboard); only admins and
 * teachers record one.
 */
@Roles(...STAFF_ROLES)
@Controller("student-cases")
export class StudentCasesController {
  constructor(private readonly cases: StudentCasesService) {}

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.ATTENDANCE_OFFICER)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createStudentCaseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.cases.create(me.schoolId, parsed.data, me.userId, me.username);
  }

  @Get()
  list(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId?: string,
    @Query("sectionId") sectionId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.cases.list(me.schoolId, { classId, sectionId, dateFrom, dateTo });
  }

  @Get("dashboard")
  dashboard(@CurrentUser() me: AuthUser) {
    return this.cases.dashboard(me.schoolId);
  }

  @Get("student/:studentId")
  forStudent(@CurrentUser() me: AuthUser, @Param("studentId") studentId: string) {
    return this.cases.forStudent(me.schoolId, studentId);
  }
}
