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
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("student-attendance")
export class StudentAttendanceController {
  constructor(private readonly attendance: StudentAttendanceService) {}

  @Roles(UserRole.ADMINISTRATOR, UserRole.ATTENDANCE_OFFICER)
  @Post("mark")
  mark(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = markStudentAttendanceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.attendance.mark(me.schoolId, parsed.data, me.userId);
  }

  @Get()
  list(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId: string,
    @Query("date") date: string,
    @Query("sectionId") sectionId?: string,
  ) {
    if (!classId || !date) {
      throw new BadRequestException("classId and date are required");
    }
    return this.attendance.list(me.schoolId, classId, sectionId ?? null, date);
  }

  @Get("dashboard")
  dashboard(
    @CurrentUser() me: AuthUser,
    @Query("date") date: string,
    @Query("classId") classId?: string,
    @Query("sectionId") sectionId?: string,
  ) {
    if (!date) throw new BadRequestException("date is required");
    return this.attendance.dashboard(me.schoolId, date, classId, sectionId);
  }
}
