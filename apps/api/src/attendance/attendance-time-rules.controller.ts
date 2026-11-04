import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import {
  assignAttendanceTimeRuleSchema,
  saveAttendanceTimeRuleSchema,
  UserRole,
} from "@ekulmis/shared";
import { AttendanceTimeRulesService } from "./attendance-time-rules.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { RequirePermission } from "../auth/require-permission.decorator";

/**
 * Attendance time rules — a class's own register times. Anyone who takes
 * attendance can read them (the register screen shows the class's times);
 * only administrators change them, because a rule moves the lock that
 * officers work under.
 */
@Roles(...STAFF_ROLES)
@Controller("attendance-time-rules")
export class AttendanceTimeRulesController {
  constructor(private readonly rules: AttendanceTimeRulesService) {}

  @RequirePermission("attendance.view")
  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.rules.list(me.schoolId);
  }

  @RequirePermission("attendance.view")
  @Get("class/:classId")
  forClass(@CurrentUser() me: AuthUser, @Param("classId") classId: string) {
    return this.rules.forClass(me.schoolId, classId);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @RequirePermission("attendance.update")
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveAttendanceTimeRuleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.rules.create(me.schoolId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @RequirePermission("attendance.update")
  @Patch(":id")
  update(@CurrentUser() me: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    const parsed = saveAttendanceTimeRuleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.rules.update(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @RequirePermission("attendance.update")
  @Put(":id/classes")
  assign(@CurrentUser() me: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    const parsed = assignAttendanceTimeRuleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.rules.assign(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @RequirePermission("attendance.update")
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.rules.remove(me.schoolId, id);
  }
}
