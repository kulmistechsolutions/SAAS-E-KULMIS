import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(schoolId: string, userId?: string, parentId?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.notification.findMany({
        where: {
          OR: [
            ...(userId ? [{ userId }] : []),
            ...(parentId ? [{ parentId }] : []),
            { userId: null, parentId: null },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  }

  create(
    schoolId: string,
    data: {
      title: string;
      body: string;
      type?: string;
      userId?: string;
      parentId?: string;
    },
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.notification.create({
        data: {
          schoolId,
          title: data.title,
          body: data.body,
          type: data.type ?? "INFO",
          userId: data.userId ?? null,
          parentId: data.parentId ?? null,
        },
      }),
    );
  }

  markRead(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.notification.update({
        where: { id },
        data: { readAt: new Date() },
      }),
    );
  }

  listAnnouncements(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.announcement.findMany({
        orderBy: { publishedAt: "desc" },
        take: 50,
      }),
    );
  }

  /**
   * `data.audience` is the display category (EXAM, HOLIDAY, ...); who
   * actually gets a Notification is `data.notifyAudience` — separate on
   * purpose, since "which parents see this on the bulletin board" and
   * "who gets pinged" are different questions.
   */
  async createAnnouncement(
    schoolId: string,
    data: {
      title: string;
      body: string;
      audience?: string;
      pinned?: boolean;
      notifyAudience?: "ALL" | "PARENTS" | "TEACHERS";
    },
    userId?: string,
  ) {
    const announcement = await this.prisma.forTenant(schoolId, (tx) =>
      tx.announcement.create({
        data: {
          schoolId,
          title: data.title,
          body: data.body,
          audience: data.audience ?? "ALL",
          pinned: data.pinned ?? false,
          createdByUserId: userId ?? null,
        },
      }),
    );

    await this.notifyForAnnouncement(schoolId, announcement, data.notifyAudience ?? "ALL");
    return announcement;
  }

  /**
   * "ALL" reaches everyone with a single broadcast row — every caller of
   * `list()` already ORs in `{userId: null, parentId: null}`. PARENTS/
   * TEACHERS need one row per recipient's own login user, since that's the
   * id `list()` actually matches against (not the Parent/Teacher record id).
   */
  private async notifyForAnnouncement(
    schoolId: string,
    announcement: { title: string; body: string },
    notifyAudience: "ALL" | "PARENTS" | "TEACHERS",
  ) {
    const base = {
      schoolId,
      title: announcement.title,
      body: announcement.body,
      type: "ANNOUNCEMENT",
    };

    if (notifyAudience === "ALL") {
      await this.prisma.forTenant(schoolId, (tx) =>
        tx.notification.create({ data: { ...base, userId: null, parentId: null } }),
      );
      return;
    }

    const recipients = await this.prisma.forTenant(schoolId, (tx) =>
      notifyAudience === "PARENTS"
        ? tx.parent.findMany({ where: { status: "ACTIVE" }, select: { userId: true } })
        : tx.teacher.findMany({ where: { status: "ACTIVE" }, select: { userId: true } }),
    );
    if (recipients.length === 0) return;

    await this.prisma.forTenant(schoolId, (tx) =>
      tx.notification.createMany({
        data: recipients.map((r) => ({ ...base, userId: r.userId, parentId: null })),
      }),
    );
  }
}
