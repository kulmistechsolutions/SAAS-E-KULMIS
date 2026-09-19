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
import { RequirePermission } from "../auth/require-permission.decorator";

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

  // The list is reference data — registration forms, class pickers and
  // timetables all render it — so reading it is not gated on holding the
  // attendance module. Changing it is.
  @Get()
  list(
    @CurrentUser() me: AuthUser,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.shifts.list(me.schoolId, includeInactive === "true");
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.ATTENDANCE_OFFICER)
  @RequirePermission("attendance.update")
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveAttendanceShiftSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.shifts.create(me.schoolId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.ATTENDANCE_OFFICER)
  @RequirePermission("attendance.update")
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

  /**
   * What is riding on this shift, before anyone is asked to delete it.
   *
   * Readable by anyone who can see the list, because the delete dialog shows
   * it and the dialog is what makes "delete" an informed choice rather than a
   * button press.
   */
  @RequirePermission("attendance.view")
  @Get(":id/usage")
  usage(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.shifts.usage(me.schoolId, id);
  }

  /**
   * Retire the shift, or with `?hard=true`, delete it.
   *
   * Retiring stays the default. A hard delete keeps every attendance record —
   * their `shiftId` is `onDelete: SetNull`, and the register still opens,
   * because the marking screen falls back to the unshifted rows for the day.
   * What goes with it is which teachers worked the shift and which officers
   * held it: statements about a session that no longer exists.
   */
  @Roles(UserRole.ADMINISTRATOR, UserRole.ATTENDANCE_OFFICER)
  @RequirePermission("attendance.update")
  @Delete(":id")
  remove(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Query("hard") hard?: string,
  ) {
    return this.shifts.remove(me.schoolId, id, { hard: hard === "true" });
  }
}
