import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { NotificationsService } from "./notifications.service";
import { NotificationsGateway } from "./notifications.gateway";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { z } from "zod";

const createNotificationSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  type: z.string().optional(),
  userId: z.string().optional(),
  parentId: z.string().optional(),
});

const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: z.string().optional(),
});

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.notifications.list(me.schoolId, me.userId);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createNotificationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const note = await this.notifications.create(me.schoolId, parsed.data);
    this.gateway.emitToSchool(me.schoolId, "notification", note);
    return note;
  }

  @Patch(":id/read")
  markRead(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.notifications.markRead(me.schoolId, id);
  }

  @Get("announcements")
  announcements(@CurrentUser() me: AuthUser) {
    return this.notifications.listAnnouncements(me.schoolId);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post("announcements")
  createAnnouncement(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createAnnouncementSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.notifications.createAnnouncement(
      me.schoolId,
      parsed.data,
      me.userId,
    );
  }
}
