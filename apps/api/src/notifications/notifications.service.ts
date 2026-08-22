import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Who gets pinged for an announcement. STUDENTS is only meaningful for a
 *  school that has opted its students into the portal — see
 *  School.studentPortalEnabled. */
export type NotifyAudience = "ALL" | "PARENTS" | "TEACHERS" | "STUDENTS";

/** The event triggers a school can switch on and off individually. */
export type NotifyEvent =
  | "newStudent"
  | "examPublished"
  | "quizPublished"
  | "resultPublished";

/**
 * Settings → Notifications, resolved for one school.
 *
 * Everything defaults ON so a school that has never opened that page keeps
 * the behaviour it has today. Only `inApp` and `sms` have a delivery path
 * behind them: `email` has no mailer, and `whatsapp` is not built — the
 * settings page labels both as future, and switching them on does not make
 * a message appear.
 */
export interface NotificationPolicy {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  events: Record<NotifyEvent, boolean>;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** A school's notification preferences, defaulting to everything on. */
  async policyFor(schoolId: string): Promise<NotificationPolicy> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { notificationSettings: true },
    });
    const s = school?.notificationSettings as
      | (Partial<NotificationPolicy> & {
          events?: Partial<Record<NotifyEvent, boolean>>;
        })
      | null;
    const on = (v: boolean | undefined) => v ?? true;
    return {
      inApp: on(s?.inApp),
      email: on(s?.email),
      sms: on(s?.sms),
      whatsapp: on(s?.whatsapp),
      events: {
        newStudent: on(s?.events?.newStudent),
        examPublished: on(s?.events?.examPublished),
        quizPublished: on(s?.events?.quizPublished),
        resultPublished: on(s?.events?.resultPublished),
      },
    };
  }

  /** Whether an in-app notice should be written at all for this event. */
  private async inAppAllowed(
    schoolId: string,
    event?: NotifyEvent,
  ): Promise<boolean> {
    const policy = await this.policyFor(schoolId);
    if (!policy.inApp) return false;
    return event ? policy.events[event] : true;
  }

  /**
   * Announce something that happened, honouring the school's switches.
   *
   * Silently doing nothing is the point: a school that turned the channel or
   * the event off asked not to be told, and the work that triggered this —
   * publishing an exam, registering a student — must still succeed.
   */
  async notifyEvent(
    schoolId: string,
    event: NotifyEvent,
    data: { title: string; body: string; type?: string; userId?: string },
  ): Promise<void> {
    if (!(await this.inAppAllowed(schoolId, event))) return;
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.notification.create({
        data: {
          schoolId,
          title: data.title,
          body: data.body,
          type: data.type ?? "INFO",
          userId: data.userId ?? null,
          parentId: null,
          studentId: null,
        },
      }),
    );
  }

  list(
    schoolId: string,
    userId?: string,
    parentId?: string,
    studentId?: string,
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.notification.findMany({
        where: {
          OR: [
            ...(userId ? [{ userId }] : []),
            ...(parentId ? [{ parentId }] : []),
            ...(studentId ? [{ studentId }] : []),
            // The broadcast row — addressed to nobody in particular, so it
            // must be null on EVERY recipient column. Leaving studentId out
            // here would hand every student-only notice to all staff too.
            { userId: null, parentId: null, studentId: null },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  }

  async create(
    schoolId: string,
    data: {
      title: string;
      body: string;
      type?: string;
      userId?: string;
      parentId?: string;
      studentId?: string;
    },
  ) {
    // A school that switched the in-app channel off asked not to be pinged.
    // The caller's own work has already happened; this is only the notice.
    if (!(await this.inAppAllowed(schoolId))) return null;
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.notification.create({
        data: {
          schoolId,
          title: data.title,
          body: data.body,
          type: data.type ?? "INFO",
          userId: data.userId ?? null,
          parentId: data.parentId ?? null,
          studentId: data.studentId ?? null,
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

  /**
   * `viewerAudience` scopes the bulletin board to what that portal is allowed
   * to see. Omit it (the admin/staff view) to see everything regardless of
   * who it was addressed to.
   */
  listAnnouncements(
    schoolId: string,
    viewerAudience?: Exclude<NotifyAudience, "ALL">,
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.announcement.findMany({
        where: viewerAudience
          ? { OR: [{ targetAudience: "ALL" }, { targetAudience: viewerAudience }] }
          : undefined,
        orderBy: { publishedAt: "desc" },
        take: 50,
      }),
    );
  }

  /**
   * `data.audience` is the display category (EXAM, HOLIDAY, ...), purely
   * cosmetic. `data.notifyAudience` is the real recipient scope: it decides
   * both who gets a Notification (bell icon) and — via targetAudience on the
   * saved row — who can see this on their portal's bulletin board at all.
   */
  async createAnnouncement(
    schoolId: string,
    data: {
      title: string;
      body: string;
      audience?: string;
      pinned?: boolean;
      notifyAudience?: NotifyAudience;
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
          targetAudience: data.notifyAudience ?? "ALL",
          pinned: data.pinned ?? false,
          createdByUserId: userId ?? null,
        },
      }),
    );

    if (await this.inAppAllowed(schoolId)) {
      await this.notifyForAnnouncement(
        schoolId,
        announcement,
        data.notifyAudience ?? "ALL",
      );
    }
    return announcement;
  }

  /** Edit an announcement already on the bulletin board — title, body,
   *  category and/or target audience. Does not re-send Notification bell
   *  rows: those already reached their recipients when it was created, and
   *  this only changes what the board itself shows going forward. */
  async updateAnnouncement(
    schoolId: string,
    id: string,
    data: {
      title?: string;
      body?: string;
      audience?: string;
      pinned?: boolean;
      targetAudience?: NotifyAudience;
    },
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const existing = await tx.announcement.findFirst({ where: { id } });
      if (!existing) throw new BadRequestException("Announcement not found");
      return tx.announcement.update({
        where: { id },
        data: {
          title: data.title,
          body: data.body,
          audience: data.audience,
          pinned: data.pinned,
          targetAudience: data.targetAudience,
        },
      });
    });
  }

  async deleteAnnouncement(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const existing = await tx.announcement.findFirst({ where: { id } });
      if (!existing) throw new BadRequestException("Announcement not found");
      await tx.announcement.delete({ where: { id } });
      return { ok: true };
    });
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
    notifyAudience: NotifyAudience,
  ) {
    const base = {
      schoolId,
      title: announcement.title,
      body: announcement.body,
      type: "ANNOUNCEMENT",
    };

    if (notifyAudience === "ALL") {
      await this.prisma.forTenant(schoolId, (tx) =>
        tx.notification.create({
          data: { ...base, userId: null, parentId: null, studentId: null },
        }),
      );
      return;
    }

    // Students have no login User, so they are addressed by studentId — and
    // only reachable at all once the school has turned the student portal on.
    if (notifyAudience === "STUDENTS") {
      const school = await this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { studentPortalEnabled: true },
      });
      if (!school?.studentPortalEnabled) {
        throw new BadRequestException(
          "Turn on the Student Portal in Settings → Students before sending notices to students.",
        );
      }
      const students = await this.prisma.forTenant(schoolId, (tx) =>
        tx.student.findMany({ where: { status: "ACTIVE" }, select: { id: true } }),
      );
      if (students.length === 0) return;
      await this.prisma.forTenant(schoolId, (tx) =>
        tx.notification.createMany({
          data: students.map((s) => ({
            ...base,
            userId: null,
            parentId: null,
            studentId: s.id,
          })),
        }),
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
        data: recipients.map((r) => ({
          ...base,
          userId: r.userId,
          parentId: null,
          studentId: null,
        })),
      }),
    );
  }
}
