import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from "@nestjs/common";
import { markStudentAttendanceSchema, UserRole } from "@ekulmis/shared";
import { StudentAttendanceService } from "./student-attendance.service";
import { TeachersService } from "../teachers/teachers.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

// Staff-only by default (excludes PARENT/STUDENT). The `mark` handler below
// overrides this with a stricter write-role set.
@Roles(...STAFF_ROLES)
@Controller("student-attendance")
export class StudentAttendanceController {
  constructor(
    private readonly attendance: StudentAttendanceService,
    private readonly teachers: TeachersService,
  ) {}

  private async assertTeacherClassAccess(
    me: AuthUser,
    classId: string,
    sectionId?: string | null,
  ) {
    if (me.role !== "TEACHER") return;
    await this.teachers.assertOwnsAssignment(me.schoolId, me.userId, {
      classId,
      sectionId: sectionId ?? null,
    });
  }

  @Roles(
    UserRole.ADMINISTRATOR,
    UserRole.ATTENDANCE_OFFICER,
    UserRole.TEACHER,
  )
  @Post("mark")
  async mark(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = markStudentAttendanceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    await this.assertTeacherClassAccess(
      me,
      parsed.data.classId,
      parsed.data.sectionId,
    );
    return this.attendance.mark(me.schoolId, parsed.data, me.userId);
  }

  @Get()
  async list(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId: string,
    @Query("date") date: string,
    @Query("sectionId") sectionId?: string,
  ) {
    if (!classId || !date) {
      throw new BadRequestException("classId and date are required");
    }
    await this.assertTeacherClassAccess(me, classId, sectionId ?? null);
    return this.attendance.list(me.schoolId, classId, sectionId ?? null, date);
  }

  @Get("dashboard")
  async dashboard(
    @CurrentUser() me: AuthUser,
    @Query("date") date: string,
    @Query("classId") classId?: string,
    @Query("sectionId") sectionId?: string,
  ) {
    if (!date) throw new BadRequestException("date is required");
    if (me.role === "TEACHER") {
      if (!classId) {
        throw new BadRequestException(
          "Teachers must provide classId for attendance dashboard",
        );
      }
      await this.assertTeacherClassAccess(me, classId, sectionId ?? null);
    }
    return this.attendance.dashboard(me.schoolId, date, classId, sectionId);
  }
}
