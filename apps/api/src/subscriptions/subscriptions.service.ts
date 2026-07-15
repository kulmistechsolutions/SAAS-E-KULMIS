import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  AssignSchoolSubscriptionInput,
  CreateSubscriptionPlanInput,
  UpdateSubscriptionPlanInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

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
  constructor(private readonly prisma: PrismaService) {}

  // ── Super Admin: plan catalog ────────────────────────────────────────

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  async createPlan(dto: CreateSubscriptionPlanInput) {
    try {
      return await this.prisma.subscriptionPlan.create({
        data: {
          name: dto.name,
          maxStudents: dto.maxStudents,
          durationDays: dto.durationDays,
          aiGradingMonthlyQuota: dto.aiGradingMonthlyQuota,
          priceUsd: dto.priceUsd ?? null,
        },
      });
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

  async updatePlan(id: string, dto: UpdateSubscriptionPlanInput) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Plan not found");
    try {
      return await this.prisma.subscriptionPlan.update({
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

  async deletePlan(id: string) {
    const inUse = await this.prisma.schoolSubscription.findFirst({
      where: { planId: id },
    });
    if (inUse) {
      throw new ConflictException(
        "This plan is assigned to at least one school — reassign those schools first.",
      );
    }
    await this.prisma.subscriptionPlan.delete({ where: { id } });
    return { success: true };
  }

  // ── Super Admin: per-school assignment + roster ──────────────────────

  /** Every school with its current subscription (if any) and live usage. */
  async listSchoolSubscriptions() {
    const schools = await this.prisma.school.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true,
        _count: { select: { users: true } },
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
              aiGradingUsed: sub.aiGradingUsed,
              plan: sub.plan,
            }
          : null,
      };
    });
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
  ) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException("School not found");

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan) throw new NotFoundException("Plan not found");

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = addDays(startDate, plan.durationDays);

    return this.prisma.schoolSubscription.upsert({
      where: { schoolId },
      create: {
        schoolId,
        planId: plan.id,
        status: "ACTIVE",
        startDate,
        endDate,
        aiGradingUsed: 0,
        aiGradingResetAt: startDate,
      },
      update: {
        planId: plan.id,
        status: "ACTIVE",
        startDate,
        endDate,
        aiGradingUsed: 0,
        aiGradingResetAt: startDate,
      },
      include: { plan: true },
    });
  }

  async cancelSubscription(schoolId: string) {
    const sub = await this.prisma.schoolSubscription.findUnique({
      where: { schoolId },
    });
    if (!sub) throw new NotFoundException("This school has no subscription.");
    return this.prisma.schoolSubscription.update({
      where: { schoolId },
      data: { status: "CANCELLED" },
    });
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
      return this.prisma.schoolSubscription.update({
        where: { schoolId },
        data: { status: "EXPIRED" },
        include: { plan: true },
      });
    }
    return sub;
  }

  /** Throws if the school cannot register another student under its plan. */
  async assertCanAddStudent(schoolId: string): Promise<void> {
    const sub = await this.getSubscription(schoolId);
    if (!sub || sub.status !== "ACTIVE") {
      throw new ForbiddenException(
        "No active subscription for this school. Contact your platform administrator to assign or renew a plan before adding students.",
      );
    }
    if (sub.plan.maxStudents == null) return;
    const count = await this.prisma.student.count({ where: { schoolId } });
    if (count >= sub.plan.maxStudents) {
      throw new ForbiddenException(
        `Student limit reached (${count}/${sub.plan.maxStudents}) for your "${sub.plan.name}" plan. Upgrade your plan to add more students.`,
      );
    }
  }

  /**
   * Returns true if AI grading is available for this school right now
   * (active subscription + quota remaining), and records one unit of usage
   * when it is. Never throws — callers should gracefully fall back to
   * manual review when this returns false, since AI quota exhaustion
   * shouldn't block a student from submitting a quiz.
   */
  async tryConsumeAiGrading(schoolId: string): Promise<boolean> {
    const sub = await this.getSubscription(schoolId);
    if (!sub || sub.status !== "ACTIVE") return false;
    if (sub.plan.aiGradingMonthlyQuota == null) return true;

    const now = new Date();
    let used = sub.aiGradingUsed;
    let resetAt = sub.aiGradingResetAt;
    if (!isSameMonth(resetAt, now)) {
      used = 0;
      resetAt = now;
    }
    if (used >= sub.plan.aiGradingMonthlyQuota) return false;

    await this.prisma.schoolSubscription.update({
      where: { schoolId },
      data: { aiGradingUsed: used + 1, aiGradingResetAt: resetAt },
    });
    return true;
  }

  /** Usage summary for the school's own settings/dashboard. */
  async getMySubscription(schoolId: string) {
    const sub = await this.getSubscription(schoolId);
    if (!sub) return null;
    const studentCount = await this.prisma.student.count({
      where: { schoolId },
    });
    return {
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      studentCount,
      aiGradingUsed: isSameMonth(sub.aiGradingResetAt, new Date())
        ? sub.aiGradingUsed
        : 0,
      plan: sub.plan,
    };
  }
}
