import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type {
  AssignSchoolSubscriptionInput,
  CreateSubscriptionPlanInput,
  PurchaseSubscriptionPlanInput,
  UpdateSubscriptionPlanInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  isApprovedCallbackStatus,
  normalizeWaafiAccount,
  waafiApiPurchase,
  waafiGetTranInfo,
  waafiHppPurchase,
  type WaafiCredentials,
} from "../sms/waafi.client";

const ORDER_TTL_MS = 15 * 60 * 1000; // 15 minutes

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
const MSG_TEACHER_LIMIT = "Maximum teacher limit reached.";
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
    const teacherCount = await this.prisma.teacher.count({ where: { schoolId } });

    if (!sub) {
      return {
        school,
        studentCount,
        teacherCount,
        subscription: null,
      };
    }

    const status = this.effectiveStatus(sub);
    const maxStudents = sub.plan.maxStudents;
    const maxTeachers = sub.plan.maxTeachers;
    const aiQuota = sub.plan.aiGradingMonthlyQuota;
    const aiUsed = isSameMonth(sub.aiGradingResetAt, new Date())
      ? sub.aiGradingUsed
      : 0;

    return {
      school,
      studentCount,
      teacherCount,
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
        teacherLimit: maxTeachers,
        teachersUsed: teacherCount,
        teachersRemaining:
          maxTeachers == null ? null : Math.max(0, maxTeachers - teacherCount),
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

  /** Throws if the school cannot register another teacher under its plan. */
  async assertCanAddTeacher(schoolId: string): Promise<void> {
    const sub = await this.getSubscription(schoolId);
    if (!sub || sub.status !== "ACTIVE") {
      throw new ForbiddenException(MSG_EXPIRED);
    }
    if (sub.plan.maxTeachers == null) return;
    const count = await this.prisma.teacher.count({ where: { schoolId } });
    if (count >= sub.plan.maxTeachers) {
      throw new ForbiddenException(MSG_TEACHER_LIMIT);
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
        teacherCount: await this.prisma.teacher.count({ where: { schoolId } }),
        teacherLimit: null,
        teachersRemaining: null,
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
    const teacherCount = await this.prisma.teacher.count({
      where: { schoolId },
    });
    const status = this.effectiveStatus(sub);
    const remaining = daysUntil(sub.endDate);
    const aiUsed = isSameMonth(sub.aiGradingResetAt, new Date())
      ? sub.aiGradingUsed
      : 0;
    const maxStudents = sub.plan.maxStudents;
    const maxTeachers = sub.plan.maxTeachers;
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
      teacherCount,
      teacherLimit: maxTeachers,
      teachersRemaining:
        maxTeachers == null ? null : Math.max(0, maxTeachers - teacherCount),
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

  // ── School self-service: browse + purchase a plan via WaafiPay ───────
  // Mirrors SmsPaymentService's flow exactly (same shared WaafiPaymentConfig
  // / merchant account) — just activates a SchoolSubscription instead of
  // SMS credits.

  /** Active plans a school can browse/purchase. No pricing secrets involved. */
  listAvailablePlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceUsd: "asc" },
    });
  }

  private async ensureWaafiConfig() {
    const existing = await this.prisma.waafiPaymentConfig.findFirst();
    if (existing) return existing;
    return this.prisma.waafiPaymentConfig.create({
      data: {
        baseUrl: process.env.WAAFI_BASE_URL ?? "https://sandbox.waafipay.net/asm",
        merchantUid: process.env.WAAFI_MERCHANT_UID ?? "",
        apiUserId: process.env.WAAFI_API_USER_ID ?? "",
        apiKey: process.env.WAAFI_API_KEY ?? "",
        storeId: process.env.WAAFI_STORE_ID ?? "",
        hppKey: process.env.WAAFI_HPP_KEY ?? "",
        callbackBaseUrl: process.env.WAAFI_CALLBACK_BASE_URL ?? null,
      },
    });
  }

  private toWaafiCreds(row: {
    baseUrl: string;
    merchantUid: string;
    apiUserId: string;
    apiKey: string;
    storeId: string;
    hppKey: string;
  }): WaafiCredentials {
    return {
      baseUrl: row.baseUrl,
      merchantUid: row.merchantUid,
      apiUserId: row.apiUserId,
      apiKey: row.apiKey,
      storeId: row.storeId,
      hppKey: row.hppKey,
    };
  }

  private async requirePaymentsUnlocked() {
    const cfg = await this.ensureWaafiConfig();
    const unlocked = cfg.simulationMode || (cfg.connectionVerified && cfg.enabled);
    if (!unlocked) {
      throw new ConflictException(
        "WaafiPay payments are disabled by Super Admin. Enable them in Platform → Waafi Payments.",
      );
    }
    return cfg;
  }

  private makeSubscriptionReferenceId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = randomBytes(4).toString("hex").toUpperCase();
    return `SUB-${ts}-${rnd}`;
  }

  private async nextSubscriptionReceipt(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const count = await tx.subscriptionPaymentOrder.count({
      where: { receiptNumber: { not: null } },
    });
    return `SUBRCP${String(count + 1).padStart(6, "0")}`;
  }

  private async auditPayment(
    orderId: string,
    schoolId: string,
    action: string,
    success: boolean,
    message: string,
    details?: Record<string, unknown>,
    actorId?: string,
  ) {
    await this.prisma.subscriptionPaymentAuditLog.create({
      data: {
        orderId,
        schoolId,
        action,
        success,
        message,
        details: details ? (details as Prisma.InputJsonValue) : undefined,
        actorId: actorId ?? null,
      },
    });
  }

  async initiateSubscriptionPurchase(
    schoolId: string,
    userId: string,
    input: PurchaseSubscriptionPlanInput,
  ) {
    const cfg = await this.requirePaymentsUnlocked();
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: input.planId },
    });
    if (!plan || !plan.isActive) {
      throw new NotFoundException("Plan not found or inactive.");
    }
    if (plan.priceUsd == null) {
      throw new BadRequestException(
        "This plan has no price set — contact Platform Administrator.",
      );
    }

    const channel =
      input.channel ?? (cfg.defaultMethod as "API_PURCHASE" | "HPP_PURCHASE");
    const paymentMethod = input.paymentMethod ?? "MWALLET_ACCOUNT";

    let payerAccount: string | null = null;
    if (input.payerAccount) {
      payerAccount = normalizeWaafiAccount(input.payerAccount);
      if (!/^\d{9,15}$/.test(payerAccount)) {
        throw new BadRequestException(
          "Invalid payer mobile number. Use international format, e.g. 252611111111.",
        );
      }
    }
    if (channel === "API_PURCHASE" && !payerAccount) {
      throw new BadRequestException(
        "payerAccount (mobile wallet number) is required for direct Waafi payment.",
      );
    }

    await this.expireStaleSubscriptionOrders(schoolId);

    const referenceId = this.makeSubscriptionReferenceId();
    const amount = Number(plan.priceUsd);
    const expiresAt = new Date(Date.now() + ORDER_TTL_MS);

    const order = await this.prisma.subscriptionPaymentOrder.create({
      data: {
        schoolId,
        planId: plan.id,
        referenceId,
        invoiceId: referenceId,
        amount: plan.priceUsd,
        currency: cfg.currency || "USD",
        status: "PENDING",
        paymentMethod,
        channel,
        payerAccount,
        initiatedByUserId: userId,
        expiresAt,
      },
    });

    await this.auditPayment(
      order.id,
      schoolId,
      "CREATED",
      true,
      "Payment order created",
      { planId: plan.id, amount, channel, referenceId, simulation: cfg.simulationMode },
      userId,
    );

    if (cfg.simulationMode) {
      const simTxn = `SIM-${Date.now()}`;
      await this.prisma.subscriptionPaymentOrder.update({
        where: { id: order.id },
        data: {
          status: "PROCESSING",
          channel: "SIMULATION",
          waafiTransactionId: simTxn,
          responsePayload: {
            simulation: true,
            message: "Simulated WaafiPay approval",
            referenceId,
          } as Prisma.InputJsonValue,
        },
      });
      await this.auditPayment(
        order.id,
        schoolId,
        "WAAFI_RESPONSE",
        true,
        "Simulated WaafiPay approval (simulation mode)",
        { transactionId: simTxn },
        userId,
      );
      return this.activateSubscriptionOrder(order.id, {
        transactionId: simTxn,
        responsePayload: { simulation: true, referenceId },
      });
    }

    const creds = this.toWaafiCreds(cfg);
    const description = `Subscription plan: ${plan.name}`;

    if (channel === "HPP_PURCHASE") {
      const callbackBase =
        cfg.callbackBaseUrl?.replace(/\/+$/, "") ||
        process.env.WAAFI_CALLBACK_BASE_URL?.replace(/\/+$/, "");
      if (!callbackBase) {
        await this.failSubscriptionOrder(
          order.id,
          schoolId,
          "Callback base URL is not configured by Super Admin.",
        );
        throw new ConflictException(
          "Payment callbacks are not configured. Contact platform administrator.",
        );
      }

      const result = await waafiHppPurchase(creds, {
        accountNo: payerAccount ?? undefined,
        referenceId,
        amount,
        currency: order.currency,
        description,
        successCallbackUrl: `${callbackBase}/api/subscriptions/payments/waafi/callback/success`,
        failureCallbackUrl: `${callbackBase}/api/subscriptions/payments/waafi/callback/failure`,
      });

      await this.prisma.subscriptionPaymentOrder.update({
        where: { id: order.id },
        data: {
          status: result.ok ? "PROCESSING" : "FAILED",
          waafiRequestId: result.requestId,
          waafiOrderId: result.orderId ?? null,
          hppUrl: result.hppUrl ?? result.directPaymentLink ?? null,
          requestPayload: result.requestBody as Prisma.InputJsonValue,
          responsePayload: result.raw as Prisma.InputJsonValue,
          failureReason: result.ok ? null : result.responseMsg,
        },
      });

      await this.auditPayment(
        order.id,
        schoolId,
        "WAAFI_RESPONSE",
        result.ok,
        result.ok ? "HPP session created" : result.responseMsg,
        { responseCode: result.responseCode, orderId: result.orderId },
        userId,
      );

      if (!result.ok) {
        throw new BadRequestException(
          result.responseMsg || "Failed to create Waafi hosted payment session.",
        );
      }

      return this.getSubscriptionOrderReceipt(schoolId, order.id);
    }

    // Direct API_PURCHASE
    const result = await waafiApiPurchase(creds, {
      accountNo: payerAccount!,
      referenceId,
      invoiceId: referenceId,
      amount,
      currency: order.currency,
      description,
      paymentMethod,
    });

    await this.prisma.subscriptionPaymentOrder.update({
      where: { id: order.id },
      data: {
        status: result.ok ? "PROCESSING" : "FAILED",
        waafiRequestId: result.requestId,
        waafiTransactionId: result.transactionId ?? null,
        waafiIssuerTxnId: result.issuerTransactionId ?? null,
        requestPayload: result.requestBody as Prisma.InputJsonValue,
        responsePayload: result.raw as Prisma.InputJsonValue,
        failureReason: result.ok ? null : result.responseMsg,
      },
    });

    await this.auditPayment(
      order.id,
      schoolId,
      "WAAFI_RESPONSE",
      result.ok,
      result.ok ? "Waafi purchase approved" : result.responseMsg,
      { responseCode: result.responseCode, transactionId: result.transactionId },
      userId,
    );

    if (!result.ok) {
      throw new BadRequestException(
        result.responseMsg || "Waafi payment was declined.",
      );
    }

    return this.activateSubscriptionOrder(order.id, {
      transactionId: result.transactionId,
      issuerTransactionId: result.issuerTransactionId,
      responsePayload: result.raw,
    });
  }

  async handleSubscriptionCallback(
    kind: "success" | "failure",
    payload: Record<string, unknown>,
  ) {
    const referenceId = String(
      payload.referenceId ?? payload.ReferenceId ?? payload.invoiceId ?? payload.InvoiceId ?? "",
    ).trim();
    if (!referenceId) return { ok: false, message: "Missing referenceId" };

    const order = await this.prisma.subscriptionPaymentOrder.findUnique({
      where: { referenceId },
    });
    if (!order) return { ok: false, message: "Unknown payment reference" };

    if (order.status === "SUCCESS") {
      return { ok: true, message: "Already activated", orderId: order.id };
    }

    await this.prisma.subscriptionPaymentOrder.update({
      where: { id: order.id },
      data: { callbackPayload: payload as Prisma.InputJsonValue },
    });

    await this.auditPayment(
      order.id,
      order.schoolId,
      "CALLBACK",
      kind === "success",
      `Waafi ${kind} callback received`,
      payload,
    );

    if (kind === "failure") {
      await this.failSubscriptionOrder(
        order.id,
        order.schoolId,
        String(payload.responseMsg ?? payload.message ?? "Payment failed"),
      );
      return { ok: false, message: "Payment marked failed", orderId: order.id };
    }

    const status = payload.status ?? payload.tranStatusDesc ?? payload.state ?? payload.Status;
    const transactionId =
      payload.transactionId ?? payload.TransactionId ?? payload.transaction_id;

    if (!isApprovedCallbackStatus(status) && !transactionId) {
      return this.verifyAndActivateSubscriptionPayment(order.id);
    }

    return this.activateSubscriptionOrder(order.id, {
      transactionId: transactionId != null ? String(transactionId) : undefined,
      responsePayload: payload,
    });
  }

  async verifyAndActivateSubscriptionPayment(orderId: string, schoolId?: string) {
    const order = await this.prisma.subscriptionPaymentOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException("Payment order not found.");
    if (schoolId && order.schoolId !== schoolId) {
      throw new ForbiddenException("Payment order does not belong to this school.");
    }
    if (order.status === "SUCCESS") {
      return this.getSubscriptionOrderReceipt(order.schoolId, order.id);
    }
    if (order.status === "CANCELLED") {
      throw new ConflictException(`Payment is ${order.status}.`);
    }
    if (order.expiresAt && order.expiresAt < new Date() && order.status === "PENDING") {
      await this.failSubscriptionOrder(order.id, order.schoolId, "Payment order expired.", "EXPIRED");
      throw new BadRequestException("Payment order expired.");
    }

    const cfg = await this.ensureWaafiConfig();
    const info = await waafiGetTranInfo(this.toWaafiCreds(cfg), order.referenceId);

    await this.prisma.subscriptionPaymentOrder.update({
      where: { id: order.id },
      data: { verifyPayload: info.raw as Prisma.InputJsonValue },
    });

    await this.auditPayment(
      order.id,
      order.schoolId,
      "VERIFY",
      info.ok,
      info.ok
        ? `Verified with Waafi (${info.status ?? info.tranStatusDesc})`
        : info.raw.responseMsg || "Verification failed",
      info.raw as unknown as Record<string, unknown>,
    );

    if (!info.ok) {
      throw new BadRequestException(
        info.raw.responseMsg || "Payment not yet confirmed by WaafiPay. Try again shortly.",
      );
    }

    return this.activateSubscriptionOrder(order.id, {
      transactionId: info.transactionId,
      responsePayload: info.raw,
    });
  }

  private async activateSubscriptionOrder(
    orderId: string,
    opts: {
      transactionId?: string;
      issuerTransactionId?: string;
      responsePayload?: unknown;
    } = {},
  ) {
    if (opts.transactionId) {
      const dup = await this.prisma.subscriptionPaymentOrder.findFirst({
        where: {
          waafiTransactionId: opts.transactionId,
          id: { not: orderId },
          status: "SUCCESS",
        },
      });
      if (dup) {
        throw new ConflictException(
          "This Waafi transaction was already applied to another order.",
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.subscriptionPaymentOrder.findUnique({
        where: { id: orderId },
        include: { plan: true },
      });
      if (!order) throw new NotFoundException("Payment order not found.");

      if (order.status === "SUCCESS") {
        return { order, alreadyActive: true };
      }
      if (order.status === "FAILED" || order.status === "EXPIRED" || order.status === "CANCELLED") {
        throw new ConflictException(`Cannot activate payment in status ${order.status}.`);
      }

      const receiptNumber = order.receiptNumber ?? (await this.nextSubscriptionReceipt(tx));

      const updated = await tx.subscriptionPaymentOrder.update({
        where: { id: order.id },
        data: {
          status: "SUCCESS",
          receiptNumber,
          waafiTransactionId: opts.transactionId ?? order.waafiTransactionId ?? null,
          waafiIssuerTxnId: opts.issuerTransactionId ?? order.waafiIssuerTxnId ?? null,
          responsePayload:
            opts.responsePayload !== undefined
              ? (opts.responsePayload as Prisma.InputJsonValue)
              : undefined,
          paidAt: new Date(),
          activatedAt: new Date(),
          failureReason: null,
        },
        include: { plan: true },
      });

      // Activate/renew the school's subscription to this plan.
      const startDate = new Date();
      const endDate = addDays(startDate, order.plan.durationDays);
      await tx.schoolSubscription.upsert({
        where: { schoolId: order.schoolId },
        create: {
          schoolId: order.schoolId,
          planId: order.planId,
          status: "ACTIVE",
          startDate,
          endDate,
          aiGradingUsed: 0,
          aiGradingResetAt: startDate,
          assignedByAdminId: null,
          assignedByUsername: null,
        },
        update: {
          planId: order.planId,
          status: "ACTIVE",
          startDate,
          endDate,
          aiGradingUsed: 0,
          aiGradingResetAt: startDate,
          assignedByAdminId: null,
          assignedByUsername: null,
        },
      });

      await tx.subscriptionHistory.create({
        data: {
          schoolId: order.schoolId,
          planId: order.planId,
          planName: order.plan.name,
          status: "ACTIVE",
          startDate,
          endDate,
          assignedByAdminId: null,
          assignedByUsername: null,
          action: "SELF_PURCHASE",
        },
      });

      await tx.subscriptionPaymentAuditLog.create({
        data: {
          schoolId: order.schoolId,
          orderId: order.id,
          action: "ACTIVATED",
          success: true,
          message: `Subscription activated — plan "${order.plan.name}"`,
          details: { receiptNumber, transactionId: opts.transactionId } as Prisma.InputJsonValue,
        },
      });

      return { order: updated, alreadyActive: false };
    });

    return this.getSubscriptionOrderReceipt(result.order.schoolId, result.order.id);
  }

  private async failSubscriptionOrder(
    orderId: string,
    schoolId: string,
    reason: string,
    status: "FAILED" | "EXPIRED" | "CANCELLED" = "FAILED",
  ) {
    await this.prisma.subscriptionPaymentOrder.update({
      where: { id: orderId },
      data: { status, failureReason: reason },
    });
    await this.auditPayment(
      orderId,
      schoolId,
      status === "EXPIRED" ? "EXPIRED" : "FAILED",
      false,
      reason,
    );
  }

  async expireStaleSubscriptionOrders(schoolId?: string) {
    const where: Prisma.SubscriptionPaymentOrderWhereInput = {
      status: { in: ["PENDING", "PROCESSING"] },
      expiresAt: { lt: new Date() },
      ...(schoolId ? { schoolId } : {}),
    };
    const stale = await this.prisma.subscriptionPaymentOrder.findMany({ where, take: 100 });
    for (const o of stale) {
      await this.failSubscriptionOrder(o.id, o.schoolId, "Payment order timed out.", "EXPIRED");
    }
    return { expired: stale.length };
  }

  async listSchoolSubscriptionOrders(schoolId: string) {
    await this.expireStaleSubscriptionOrders(schoolId);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.subscriptionPaymentOrder.findMany({
        where: { schoolId },
        include: { plan: { select: { id: true, name: true, priceUsd: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  }

  async getSubscriptionOrderReceipt(schoolId: string, orderId: string) {
    const order = await this.prisma.forTenant(schoolId, (tx) =>
      tx.subscriptionPaymentOrder.findFirst({
        where: { id: orderId, schoolId },
        include: {
          plan: true,
          auditLogs: { orderBy: { createdAt: "asc" }, take: 50 },
        },
      }),
    );
    if (!order) throw new NotFoundException("Payment order not found.");

    return {
      id: order.id,
      referenceId: order.referenceId,
      invoiceId: order.invoiceId,
      receiptNumber: order.receiptNumber,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      channel: order.channel,
      paymentMethod: order.paymentMethod,
      payerAccount: order.payerAccount,
      hppUrl: order.hppUrl,
      waafiTransactionId: order.waafiTransactionId,
      failureReason: order.failureReason,
      paidAt: order.paidAt,
      activatedAt: order.activatedAt,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      plan: {
        id: order.plan.id,
        name: order.plan.name,
        maxStudents: order.plan.maxStudents,
        maxTeachers: order.plan.maxTeachers,
        durationDays: order.plan.durationDays,
        aiGradingMonthlyQuota: order.plan.aiGradingMonthlyQuota,
      },
      auditLogs: order.auditLogs.map((a) => ({
        id: a.id,
        action: a.action,
        success: a.success,
        message: a.message,
        createdAt: a.createdAt,
      })),
    };
  }
}
