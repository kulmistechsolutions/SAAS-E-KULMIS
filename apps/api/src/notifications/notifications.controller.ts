import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
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
  pinned: z.boolean().optional(),
  notifyAudience: z.enum(["ALL", "PARENTS", "TEACHERS", "STUDENTS"]).optional(),
});

const updateAnnouncementSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  audience: z.string().optional(),
  pinned: z.boolean().optional(),
  targetAudience: z.enum(["ALL", "PARENTS", "TEACHERS", "STUDENTS"]).optional(),
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
  async createAnnouncement(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createAnnouncementSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const announcement = await this.notifications.createAnnouncement(
      me.schoolId,
      parsed.data,
      me.userId,
    );
    this.gateway.emitToSchool(me.schoolId, "notification", announcement);
    return announcement;
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Patch("announcements/:id")
  async updateAnnouncement(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateAnnouncementSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.notifications.updateAnnouncement(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete("announcements/:id")
  deleteAnnouncement(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.notifications.deleteAnnouncement(me.schoolId, id);
  }
}
