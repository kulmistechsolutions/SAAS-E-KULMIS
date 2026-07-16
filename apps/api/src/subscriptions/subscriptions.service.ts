import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import type {
  AssignSchoolSubscriptionInput,
  CreateSubscriptionPlanInput,
  UpdateSubscriptionPlanInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysUntil(end: Date, from = new Date()): number {
  const ms = startOfUtcDay(end).getTime() - startOfUtcDay(from).getTime();
  return Math.ceil(ms / 86_400_000);
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

const MSG_EXPIRED =
  "Your school subscription has expired. Please contact Platform Administrator.";
const MSG_STUDENT_LIMIT = "Maximum student limit reached.";
const MSG_AI_LIMIT = "Monthly AI grading quota exhausted.";

export type PlatformAdminActor = { adminId: string; username: string };

/**
 * School subscription plans + per-school assignment (Super Admin managed —
 * no self-service billing yet). Enforcement is per-feature: exceeding a
 * plan's student cap blocks new student registration, exceeding the AI
 * grading quota just falls back that answer to manual review. A school with
 * no subscription assigned, or an expired one, is treated as over-limit for
 * both gated actions until the Super Admin assigns/renews a plan.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Super Admin: plan catalog ────────────────────────────────────────

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  async createPlan(dto: CreateSubscriptionPlanInput, admin: PlatformAdminActor) {
    try {
      const plan = await this.prisma.subscriptionPlan.create({
        data: {
          name: dto.name,
          maxStudents: dto.maxStudents,
          durationDays: dto.durationDays,
          aiGradingMonthlyQuota: dto.aiGradingMonthlyQuota,
          priceUsd: dto.priceUsd ?? null,
          isActive: dto.isActive ?? true,
        },
      });
      await this.audit(admin, "CREATE_PLAN", null, plan, null);
      return plan;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("A plan with that name already exists.");
      }
      throw e;
    }
  }

  async updatePlan(
    id: string,
    dto: UpdateSubscriptionPlanInput,
    admin: PlatformAdminActor,
  ) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Plan not found");
    try {
      const plan = await this.prisma.subscriptionPlan.update({
        where: { id },
        data: {
          name: dto.name,
          maxStudents: dto.maxStudents,
          durationDays: dto.durationDays,
          aiGradingMonthlyQuota: dto.aiGradingMonthlyQuota,
          priceUsd: dto.priceUsd,
          isActive: dto.isActive,
        },
      });
      await this.audit(admin, "UPDATE_PLAN", existing, plan, null);
      return plan;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("A plan with that name already exists.");
      }
      throw e;
    }
  }

  async deletePlan(id: string, admin: PlatformAdminActor) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Plan not found");
    const inUse = await this.prisma.schoolSubscription.findFirst({
      where: { planId: id },
    });
    if (inUse) {
      throw new ConflictException(
        "This plan is assigned to at least one school — reassign those schools first.",
      );
    }
    await this.prisma.subscriptionPlan.delete({ where: { id } });
    await this.audit(admin, "DELETE_PLAN", existing, null, null);
    return { success: true };
  }

  // ── Super Admin: dashboard + roster ──────────────────────────────────

  async getDashboard() {
    const [schools, subs, studentGroups] = await Promise.all([
      this.prisma.school.findMany({
        select: { id: true, status: true },
      }),
      this.prisma.schoolSubscription.findMany({
        include: { plan: true },
      }),
      this.prisma.student.groupBy({
        by: ["schoolId"],
        _count: { _all: true },
      }),
    ]);

    const countBySchool = new Map(
      studentGroups.map((r) => [r.schoolId, r._count._all]),
    );

    let activeSchools = 0;
    let expiredSchools = 0;
    let cancelledSchools = 0;
    let unassignedSchools = 0;
    let expiringSoon = 0;
    let totalAiUsed = 0;
    let totalAiQuota = 0;
    let totalStudentsUsed = 0;
    let totalStudentCap = 0;

    const byId = new Map(subs.map((s) => [s.schoolId, s]));
    for (const school of schools) {
      const sub = byId.get(school.id);
      const students = countBySchool.get(school.id) ?? 0;
      totalStudentsUsed += students;
      if (!sub) {
        unassignedSchools++;
        continue;
      }
      const status = this.effectiveStatus(sub);
      const aiUsed = isSameMonth(sub.aiGradingResetAt, new Date())
        ? sub.aiGradingUsed
        : 0;
      totalAiUsed += aiUsed;
      if (sub.plan.aiGradingMonthlyQuota != null) {
        totalAiQuota += sub.plan.aiGradingMonthlyQuota;
      }
      if (sub.plan.maxStudents != null) {
        totalStudentCap += sub.plan.maxStudents;
      }
      if (status === "ACTIVE") {
        activeSchools++;
        const remaining = daysUntil(sub.endDate);
        if (remaining >= 0 && remaining <= 7) expiringSoon++;
      } else if (status === "EXPIRED") expiredSchools++;
      else cancelledSchools++;
    }

    return {
      totalSchools: schools.length,
      activeSchools,
      expiredSchools,
      cancelledSchools,
      unassignedSchools,
      expiringSoon,
      totalAiUsage: totalAiUsed,
      totalAiQuota: totalAiQuota || null,
      studentUsage: totalStudentsUsed,
      studentCap: totalStudentCap || null,
      subscriptionStatus: {
        ACTIVE: activeSchools,
        EXPIRED: expiredSchools,
        CANCELLED: cancelledSchools,
        UNASSIGNED: unassignedSchools,
      },
    };
  }

  /** Every school with its current subscription (if any) and live usage. */
  async listSchoolSubscriptions() {
    const schools = await this.prisma.school.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true,
      },
    });
    const subs = await this.prisma.schoolSubscription.findMany({
      include: { plan: true },
    });
    const byId = new Map(subs.map((s) => [s.schoolId, s]));
    const studentCounts = await this.prisma.student.groupBy({
      by: ["schoolId"],
      _count: { _all: true },
    });
    const countBySchool = new Map(
      studentCounts.map((r) => [r.schoolId, r._count._all]),
    );

    return schools.map((school) => {
      const sub = byId.get(school.id);
      const studentCount = countBySchool.get(school.id) ?? 0;
      const aiUsed =
        sub && isSameMonth(sub.aiGradingResetAt, new Date())
          ? sub.aiGradingUsed
          : sub
            ? 0
            : 0;
      return {
        school: {
          id: school.id,
          name: school.name,
          subdomain: school.subdomain,
          status: school.status,
        },
        studentCount,
        subscription: sub
          ? {
              id: sub.id,
              status: this.effectiveStatus(sub),
              startDate: sub.startDate,
              endDate: sub.endDate,
              aiGradingUsed: aiUsed,
              assignedByAdminId: sub.assignedByAdminId,
              assignedByUsername: sub.assignedByUsername,
              daysRemaining: daysUntil(sub.endDate),
              plan: sub.plan,
            }
          : null,
      };
    });
  }

  async getSchoolSubscriptionDetail(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true,
        createdAt: true,
      },
    });
    if (!school) throw new NotFoundException("School not found");

    const sub = await this.prisma.schoolSubscription.findUnique({
      where: { schoolId },
      include: { plan: true },
    });
    const studentCount = await this.prisma.student.count({ where: { schoolId } });

    if (!sub) {
      return {
        school,
        studentCount,
        subscription: null,
      };
    }

    const status = this.effectiveStatus(sub);
    const maxStudents = sub.plan.maxStudents;
    const aiQuota = sub.plan.aiGradingMonthlyQuota;
    const aiUsed = isSameMonth(sub.aiGradingResetAt, new Date())
      ? sub.aiGradingUsed
      : 0;

    return {
      school,
      studentCount,
      subscription: {
        id: sub.id,
        status,
        startDate: sub.startDate,
        endDate: sub.endDate,
        daysRemaining: daysUntil(sub.endDate),
        assignedByAdminId: sub.assignedByAdminId,
        assignedByUsername: sub.assignedByUsername,
        assignedAt: sub.createdAt,
        studentLimit: maxStudents,
        studentsUsed: studentCount,
        studentsRemaining:
          maxStudents == null ? null : Math.max(0, maxStudents - studentCount),
        aiLimit: aiQuota,
        aiUsed,
        aiRemaining: aiQuota == null ? null : Math.max(0, aiQuota - aiUsed),
        plan: sub.plan,
      },
    };
  }

  private effectiveStatus(sub: {
    status: string;
    endDate: Date;
  }): "ACTIVE" | "EXPIRED" | "CANCELLED" {
    if (sub.status === "CANCELLED") return "CANCELLED";
    if (sub.endDate.getTime() < Date.now()) return "EXPIRED";
    return "ACTIVE";
  }

  /** Assign or renew a school's subscription to a plan. */
  async assignSubscription(
    schoolId: string,
    dto: AssignSchoolSubscriptionInput,
    admin: PlatformAdminActor,
  ) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException("School not found");

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) throw new NotFoundException("Plan not found");
    if (!plan.isActive) {
      throw new ConflictException("Cannot assign an inactive plan.");
    }

    const previous = await this.prisma.schoolSubscription.findUnique({
      where: { schoolId },
      include: { plan: true },
    });

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = addDays(startDate, plan.durationDays);
    const action = previous ? "RENEW" : "ASSIGN";

    const sub = await this.prisma.schoolSubscription.upsert({
      where: { schoolId },
      create: {
        schoolId,
        planId: plan.id,
        status: "ACTIVE",
        startDate,
        endDate,
        aiGradingUsed: 0,
        aiGradingResetAt: startDate,
        assignedByAdminId: admin.adminId,
        assignedByUsername: admin.username,
        lastExpiryNoticeDays: null,
      },
      update: {
        planId: plan.id,
        status: "ACTIVE",
        startDate,
        endDate,
        aiGradingUsed: 0,
        aiGradingResetAt: startDate,
        assignedByAdminId: admin.adminId,
        assignedByUsername: admin.username,
        lastExpiryNoticeDays: null,
      },
      include: { plan: true },
    });

    await this.recordHistory({
      schoolId,
      planId: plan.id,
      planName: plan.name,
      status: "ACTIVE",
      startDate,
      endDate,
      assignedByAdminId: admin.adminId,
      assignedByUsername: admin.username,
      action,
    });
    await this.audit(admin, action === "RENEW" ? "RENEW_SUBSCRIPTION" : "ASSIGN_SUBSCRIPTION", previous, sub, schoolId);

    return sub;
  }

  async cancelSubscription(schoolId: string, admin: PlatformAdminActor) {
    const sub = await this.prisma.schoolSubscription.findUnique({
      where: { schoolId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException("This school has no subscription.");

    const updated = await this.prisma.schoolSubscription.update({
      where: { schoolId },
      data: { status: "CANCELLED" },
      include: { plan: true },
    });

    await this.recordHistory({
      schoolId,
      planId: sub.planId,
      planName: sub.plan.name,
      status: "CANCELLED",
      startDate: sub.startDate,
      endDate: sub.endDate,
      assignedByAdminId: admin.adminId,
      assignedByUsername: admin.username,
      action: "CANCEL",
    });
    await this.audit(admin, "CANCEL_SUBSCRIPTION", sub, updated, schoolId);

    return updated;
  }

  async listHistory(opts: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where: Prisma.SubscriptionHistoryWhereInput = {};
    if (opts.status && ["ACTIVE", "EXPIRED", "CANCELLED"].includes(opts.status)) {
      where.status = opts.status as "ACTIVE" | "EXPIRED" | "CANCELLED";
    }
    if (opts.search?.trim()) {
      const q = opts.search.trim();
      const schools = await this.prisma.school.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { subdomain: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      const schoolIds = schools.map((s) => s.id);
      where.OR = [
        { planName: { contains: q, mode: "insensitive" } },
        { assignedByUsername: { contains: q, mode: "insensitive" } },
        ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : []),
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.subscriptionHistory.count({ where }),
      this.prisma.subscriptionHistory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const schoolIds = [...new Set(rows.map((r) => r.schoolId))];
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { id: true, name: true, subdomain: true },
    });
    const schoolById = new Map(schools.map((s) => [s.id, s]));

    return {
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      rows: rows.map((r) => ({
        id: r.id,
        school: schoolById.get(r.schoolId) ?? {
          id: r.schoolId,
          name: "Unknown",
          subdomain: "—",
        },
        plan: r.planName,
        planId: r.planId,
        assignedBy: r.assignedByUsername ?? "System",
        assignedDate: r.startDate,
        expiredDate: r.endDate,
        status: r.status,
        action: r.action,
        createdAt: r.createdAt,
      })),
    };
  }

  async listExpiringAlerts() {
    const subs = await this.prisma.schoolSubscription.findMany({
      where: { status: "ACTIVE" },
      include: { plan: true },
    });
    const schoolIds = subs.map((s) => s.schoolId);
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { id: true, name: true, subdomain: true },
    });
    const byId = new Map(schools.map((s) => [s.id, s]));

    return subs
      .map((sub) => {
        const remaining = daysUntil(sub.endDate);
        return {
          school: byId.get(sub.schoolId)!,
          planName: sub.plan.name,
          endDate: sub.endDate,
          daysRemaining: remaining,
          status: this.effectiveStatus(sub),
        };
      })
      .filter(
        (r) =>
          r.school &&
          (r.status === "EXPIRED" ||
            (r.status === "ACTIVE" && r.daysRemaining >= 0 && r.daysRemaining <= 7)),
      )
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  // ── Daily cron: expire + notify ──────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyMaintenance() {
    this.logger.log("Running daily subscription expiry + notifications…");
    const expired = await this.expireDueSubscriptions();
    const notices = await this.sendExpiryNotices();
    this.logger.log(
      `Daily subscription job done — expired=${expired}, notices=${notices}`,
    );
  }

  /** Mark ACTIVE subscriptions past endDate as EXPIRED. */
  async expireDueSubscriptions(): Promise<number> {
    const due = await this.prisma.schoolSubscription.findMany({
      where: {
        status: "ACTIVE",
        endDate: { lt: startOfUtcDay() },
      },
      include: { plan: true },
    });
    for (const sub of due) {
      await this.prisma.schoolSubscription.update({
        where: { id: sub.id },
        data: { status: "EXPIRED" },
      });
      await this.recordHistory({
        schoolId: sub.schoolId,
        planId: sub.planId,
        planName: sub.plan.name,
        status: "EXPIRED",
        startDate: sub.startDate,
        endDate: sub.endDate,
        assignedByAdminId: sub.assignedByAdminId,
        assignedByUsername: sub.assignedByUsername,
        action: "EXPIRE",
      });
      try {
        await this.notifications.create(sub.schoolId, {
          title: "Subscription expired",
          body: MSG_EXPIRED,
          type: "SUBSCRIPTION_EXPIRED",
        });
      } catch (e) {
        this.logger.warn(
          `Failed to notify school ${sub.schoolId} of expiry: ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
    }
    return due.length;
  }

  /** Warn schools at 7 / 3 / 1 days remaining (once per threshold). */
  async sendExpiryNotices(): Promise<number> {
    const thresholds = [7, 3, 1] as const;
    const active = await this.prisma.schoolSubscription.findMany({
      where: { status: "ACTIVE", endDate: { gte: startOfUtcDay() } },
      include: { plan: true },
    });
    let sent = 0;
    for (const sub of active) {
      const remaining = daysUntil(sub.endDate);
      const hit = thresholds.find((t) => remaining === t);
      if (!hit) continue;
      if (sub.lastExpiryNoticeDays === hit) continue;

      const body =
        hit === 1
          ? "Your subscription expires in 1 day. Please contact Platform Administrator to renew."
          : `Your subscription expires in ${hit} days. Please contact Platform Administrator to renew.`;

      try {
        await this.notifications.create(sub.schoolId, {
          title: "Subscription expiring soon",
          body,
          type: "SUBSCRIPTION_EXPIRING",
        });
        await this.prisma.schoolSubscription.update({
          where: { id: sub.id },
          data: { lastExpiryNoticeDays: hit },
        });
        sent++;
      } catch (e) {
        this.logger.warn(
          `Failed expiry notice for ${sub.schoolId}: ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
    }
    return sent;
  }

  // ── School-scoped enforcement (called from Students/Quiz services) ───

  /** Fetch (and lazily expire) the school's subscription. Null = unassigned. */
  private async getSubscription(schoolId: string) {
    const sub = await this.prisma.schoolSubscription.findUnique({
      where: { schoolId },
      include: { plan: true },
    });
    if (!sub) return null;
    if (sub.status === "ACTIVE" && sub.endDate.getTime() < Date.now()) {
      const expired = await this.prisma.schoolSubscription.update({
        where: { schoolId },
        data: { status: "EXPIRED" },
        include: { plan: true },
      });
      await this.recordHistory({
        schoolId,
        planId: sub.planId,
        planName: sub.plan.name,
        status: "EXPIRED",
        startDate: sub.startDate,
        endDate: sub.endDate,
        assignedByAdminId: sub.assignedByAdminId,
        assignedByUsername: sub.assignedByUsername,
        action: "EXPIRE",
      });
      return expired;
    }
    return sub;
  }

  /** Throws if the school cannot register another student under its plan. */
  async assertCanAddStudent(schoolId: string): Promise<void> {
    const sub = await this.getSubscription(schoolId);
    if (!sub || sub.status !== "ACTIVE") {
      throw new ForbiddenException(MSG_EXPIRED);
    }
    if (sub.plan.maxStudents == null) return;
    const count = await this.prisma.student.count({ where: { schoolId } });
    if (count >= sub.plan.maxStudents) {
      throw new ForbiddenException(MSG_STUDENT_LIMIT);
    }
  }

  /**
   * Atomically consume one unit of monthly AI grading quota.
   * Uses SELECT … FOR UPDATE so concurrent quiz submissions cannot overshoot.
   */
  async tryConsumeAiGrading(schoolId: string): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          {
            id: string;
            status: string;
            endDate: Date;
            aiGradingUsed: number;
            aiGradingResetAt: Date;
            aiGradingMonthlyQuota: number | null;
          }[]
        >`
          SELECT
            s.id,
            s.status::text AS status,
            s."endDate",
            s."aiGradingUsed",
            s."aiGradingResetAt",
            p."aiGradingMonthlyQuota"
          FROM school_subscriptions s
          INNER JOIN subscription_plans p ON p.id = s."planId"
          WHERE s."schoolId" = ${schoolId}
          FOR UPDATE OF s
        `;

        const sub = rows[0];
        if (!sub) return false;

        const now = new Date();
        if (sub.status === "CANCELLED") return false;
        if (sub.status !== "ACTIVE" || sub.endDate.getTime() < now.getTime()) {
          if (sub.status === "ACTIVE") {
            await tx.schoolSubscription.update({
              where: { schoolId },
              data: { status: "EXPIRED" },
            });
          }
          return false;
        }

        if (sub.aiGradingMonthlyQuota == null) return true;

        let used = sub.aiGradingUsed;
        let resetAt = sub.aiGradingResetAt;
        if (!isSameMonth(resetAt, now)) {
          used = 0;
          resetAt = now;
        }
        if (used >= sub.aiGradingMonthlyQuota) return false;

        await tx.schoolSubscription.update({
          where: { schoolId },
          data: { aiGradingUsed: used + 1, aiGradingResetAt: resetAt },
        });
        return true;
      });
    } catch (e) {
      this.logger.warn(
        `AI quota consume failed for ${schoolId}: ${
          e instanceof Error ? e.message : e
        }`,
      );
      return false;
    }
  }

  /** Used by QuizService when quota is exhausted — surfaced to the UI. */
  getAiQuotaExhaustedMessage(): string {
    return MSG_AI_LIMIT;
  }

  /** Usage summary for the school's own settings/dashboard + banner. */
  async getMySubscription(schoolId: string) {
    const sub = await this.getSubscription(schoolId);
    if (!sub) {
      return {
        status: "UNASSIGNED" as const,
        banner: {
          tone: "red" as const,
          message:
            "No subscription assigned. Please contact Platform Administrator.",
        },
        startDate: null,
        endDate: null,
        daysRemaining: null,
        studentCount: await this.prisma.student.count({ where: { schoolId } }),
        studentLimit: null,
        studentsRemaining: null,
        aiGradingUsed: 0,
        aiLimit: null,
        aiRemaining: null,
        plan: null,
        assignedByUsername: null,
        assignedAt: null,
      };
    }

    const studentCount = await this.prisma.student.count({
      where: { schoolId },
    });
    const status = this.effectiveStatus(sub);
    const remaining = daysUntil(sub.endDate);
    const aiUsed = isSameMonth(sub.aiGradingResetAt, new Date())
      ? sub.aiGradingUsed
      : 0;
    const maxStudents = sub.plan.maxStudents;
    const aiQuota = sub.plan.aiGradingMonthlyQuota;

    let tone: "green" | "orange" | "red" = "green";
    let message = `Your subscription is active until ${sub.endDate.toISOString().slice(0, 10)}.`;
    if (status === "EXPIRED" || status === "CANCELLED") {
      tone = "red";
      message = MSG_EXPIRED;
    } else if (remaining <= 1) {
      tone = "orange";
      message = "Your subscription expires in 1 day.";
    } else if (remaining <= 3) {
      tone = "orange";
      message = `Your subscription expires in ${remaining} days.`;
    } else if (remaining <= 7) {
      tone = "orange";
      message = `Your subscription expires in ${remaining} days.`;
    }

    return {
      status,
      banner: { tone, message },
      startDate: sub.startDate,
      endDate: sub.endDate,
      daysRemaining: remaining,
      studentCount,
      studentLimit: maxStudents,
      studentsRemaining:
        maxStudents == null ? null : Math.max(0, maxStudents - studentCount),
      aiGradingUsed: aiUsed,
      aiLimit: aiQuota,
      aiRemaining: aiQuota == null ? null : Math.max(0, aiQuota - aiUsed),
      plan: sub.plan,
      assignedByUsername: sub.assignedByUsername,
      assignedAt: sub.createdAt,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private async recordHistory(row: {
    schoolId: string;
    planId: string;
    planName: string;
    status: "ACTIVE" | "EXPIRED" | "CANCELLED";
    startDate: Date;
    endDate: Date;
    assignedByAdminId: string | null;
    assignedByUsername: string | null;
    action: string;
  }) {
    await this.prisma.subscriptionHistory.create({ data: row });
  }

  private async audit(
    admin: PlatformAdminActor,
    action: string,
    oldValue: unknown,
    newValue: unknown,
    schoolId: string | null,
  ) {
    try {
      await this.prisma.platformAuditLog.create({
        data: {
          adminId: admin.adminId,
          username: admin.username,
          schoolId,
          action,
          module: "subscriptions",
          oldValue: oldValue
            ? (JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          newValue: newValue
            ? (JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to write platform audit log: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
