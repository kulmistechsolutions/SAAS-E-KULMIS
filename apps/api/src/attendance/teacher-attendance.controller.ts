import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from "@nestjs/common";
import { markTeacherAttendanceSchema, UserRole } from "@ekulmis/shared";
import { TeacherAttendanceService } from "./teacher-attendance.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("teacher-attendance")
export class TeacherAttendanceController {
  constructor(private readonly attendance: TeacherAttendanceService) {}

  @Roles(UserRole.ADMINISTRATOR, UserRole.ATTENDANCE_OFFICER)
  @Post("mark")
  mark(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = markTeacherAttendanceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.attendance.mark(me.schoolId, parsed.data, me.userId);
  }

  @Get()
  list(
    @CurrentUser() me: AuthUser,
    @Query("shift") shift: string,
    @Query("date") date: string,
  ) {
    if (!shift || !date) {
      throw new BadRequestException("shift and date are required");
    }
    return this.attendance.list(me.schoolId, shift, date);
  }

  @Get("dashboard")
  dashboard(
    @CurrentUser() me: AuthUser,
    @Query("date") date: string,
    @Query("shift") shift?: string,
  ) {
    if (!date) throw new BadRequestException("date is required");
    return this.attendance.dashboard(me.schoolId, date, shift);
  }
}
