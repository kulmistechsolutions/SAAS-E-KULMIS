import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { saveAttendanceShiftSchema, UserRole } from "@ekulmis/shared";
import { AttendanceShiftsService } from "./attendance-shifts.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/**
 * Attendance Shift Management — a school's own list of named sessions
 * ("Morning", "Afternoon") used to tag attendance. Any staff role can read
 * the list (needed to mark attendance); only admins/attendance officers can
 * create, rename, or retire one.
 */
@Roles(...STAFF_ROLES)
@Controller("attendance-shifts")
export class AttendanceShiftsController {
  constructor(private readonly shifts: AttendanceShiftsService) {}

  @Get()
  list(
    @CurrentUser() me: AuthUser,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.shifts.list(me.schoolId, includeInactive === "true");
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.ATTENDANCE_OFFICER)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveAttendanceShiftSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.shifts.create(me.schoolId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.ATTENDANCE_OFFICER)
  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = saveAttendanceShiftSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.shifts.update(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.ATTENDANCE_OFFICER)
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.shifts.remove(me.schoolId, id);
  }
}
