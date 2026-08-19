import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { UserRole } from "@ekulmis/shared";
import { ParentPortalService } from "./parent-portal.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { NotificationsService } from "../notifications/notifications.service";

@Roles(UserRole.PARENT, UserRole.ADMINISTRATOR)
@Controller("parent-portal")
export class ParentPortalController {
  constructor(
    private readonly portal: ParentPortalService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get("me")
  me(@CurrentUser() me: AuthUser) {
    return this.portal.me(me.schoolId, me.userId);
  }

  @Get("children")
  children(@CurrentUser() me: AuthUser) {
    return this.portal.children(me.schoolId, me.userId);
  }

  @Get("children/:studentId/timetable")
  timetable(@CurrentUser() me: AuthUser, @Param("studentId") studentId: string) {
    return this.portal.childTimetable(me.schoolId, studentId, me.userId);
  }

  @Get("children/:studentId/attendance")
  attendance(@CurrentUser() me: AuthUser, @Param("studentId") studentId: string) {
    return this.portal.childAttendance(me.schoolId, studentId, me.userId);
  }

  @Get("children/:studentId/cases")
  cases(@CurrentUser() me: AuthUser, @Param("studentId") studentId: string) {
    return this.portal.childCases(me.schoolId, studentId, me.userId);
  }

  @Get("children/:studentId/fees")
  fees(@CurrentUser() me: AuthUser, @Param("studentId") studentId: string) {
    return this.portal.childFees(me.schoolId, studentId, me.userId);
  }

  @Get("children/:studentId/results")
  results(@CurrentUser() me: AuthUser, @Param("studentId") studentId: string) {
    return this.portal.childResults(me.schoolId, studentId, me.userId);
  }

  @Get("children/:studentId/photo")
  async photo(
    @CurrentUser() me: AuthUser,
    @Param("studentId") studentId: string,
    @Res() res: Response,
  ) {
    const { buffer, contentType } = await this.portal.childPhoto(
      me.schoolId,
      studentId,
      me.userId,
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buffer);
  }

  @Get("notifications")
  listNotifications(@CurrentUser() me: AuthUser) {
    return this.notificationsService.list(me.schoolId, me.userId);
  }

  @Get("announcements")
  announcements(@CurrentUser() me: AuthUser) {
    return this.notificationsService.listAnnouncements(me.schoolId);
  }
}
