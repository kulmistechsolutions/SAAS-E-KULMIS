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

  createAnnouncement(
    schoolId: string,
    data: { title: string; body: string; audience?: string },
    userId?: string,
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.announcement.create({
        data: {
          schoolId,
          title: data.title,
          body: data.body,
          audience: data.audience ?? "ALL",
          createdByUserId: userId ?? null,
        },
      }),
    );
  }
}
