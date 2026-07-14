import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { TeacherPortalService } from "./teacher-portal.service";
import { TeachersService } from "../teachers/teachers.service";

@Roles(UserRole.TEACHER)
@Controller("teacher-portal")
export class TeacherPortalController {
  constructor(
    private readonly portal: TeacherPortalService,
    private readonly teachers: TeachersService,
  ) {}

  @Get("profile")
  profile(@CurrentUser() me: AuthUser) {
    return this.portal.profile(me.schoolId, me.userId);
  }

  @Get("dashboard")
  dashboard(@CurrentUser() me: AuthUser) {
    return this.portal.dashboard(me.schoolId, me.userId);
  }

  @Get("students")
  async students(@CurrentUser() me: AuthUser) {
    return this.portal.students(me.schoolId, me.userId);
  }

  @Get("announcements")
  announcements(@CurrentUser() me: AuthUser) {
    return this.portal.announcements(me.schoolId);
  }

  @Get("notifications")
  notifications(@CurrentUser() me: AuthUser) {
    return this.portal.notifications(me.schoolId, me.userId);
  }

  @Get("results/student/:studentId")
  studentResults(
    @CurrentUser() me: AuthUser,
    @Param("studentId") studentId: string,
    @Query("academicYearId") academicYearId?: string,
  ) {
    return this.portal.studentResults(
      me.schoolId,
      me.userId,
      studentId,
      academicYearId,
    );
  }

  @Get("results/class")
  classResults(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId: string,
    @Query("classId") classId: string,
    @Query("sectionId") sectionId: string,
    @Query("examId") examId?: string,
  ) {
    if (!academicYearId || !classId || !sectionId) {
      throw new BadRequestException(
        "academicYearId, classId, and sectionId are required",
      );
    }
    return this.portal.classResults(me.schoolId, me.userId, {
      academicYearId,
      classId,
      sectionId,
      examId,
    });
  }

  @Get("permissions")
  async permissions(@CurrentUser() me: AuthUser) {
    const teacher = await this.teachers.findByUserId(me.schoolId, me.userId);
    return {
      canViewStudents: teacher.canViewStudents,
      assignmentCount: teacher.assignments.length,
    };
  }
}
