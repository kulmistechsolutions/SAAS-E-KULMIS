import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { Roles } from "../auth/roles.decorator";
import { RequirePermission } from "../auth/require-permission.decorator";
import {
  ExamScheduleService,
  roomSchema,
  timetablePatchSchema,
  timetableSchema,
} from "./exam-schedule.service";

function parse<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException(r.error.flatten());
  return r.data;
}

@Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER, UserRole.ACADEMIC_MANAGER)
@Controller("exam-schedule")
export class ExamScheduleController {
  constructor(private readonly svc: ExamScheduleService) {}

  @RequirePermission("examinations.view")
  @Get("rooms")
  rooms(@CurrentUser() me: AuthUser) {
    return this.svc.listRooms(me.schoolId);
  }

  @RequirePermission("examinations.create")
  @Post("rooms")
  createRoom(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    return this.svc.createRoom(me.schoolId, parse(roomSchema, body));
  }

  @RequirePermission("examinations.update")
  @Patch("rooms/:id")
  updateRoom(@CurrentUser() me: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.svc.updateRoom(me.schoolId, id, parse(roomSchema, body));
  }

  @RequirePermission("examinations.delete")
  @Delete("rooms/:id")
  deleteRoom(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.svc.deleteRoom(me.schoolId, id);
  }

  @RequirePermission("examinations.view")
  @Get("timetables")
  timetables(@CurrentUser() me: AuthUser) {
    return this.svc.listTimetables(me.schoolId);
  }

  @RequirePermission("examinations.create")
  @Post("timetables")
  createTimetable(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    return this.svc.createTimetable(me.schoolId, parse(timetableSchema, body));
  }

  @RequirePermission("examinations.update")
  @Patch("timetables/:id")
  updateTimetable(@CurrentUser() me: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.svc.updateTimetable(me.schoolId, id, parse(timetablePatchSchema, body));
  }

  @RequirePermission("examinations.delete")
  @Delete("timetables/:id")
  deleteTimetable(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.svc.deleteTimetable(me.schoolId, id);
  }
}
