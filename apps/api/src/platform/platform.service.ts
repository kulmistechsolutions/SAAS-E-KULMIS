import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Platform-wide analytics across ALL tenants (Super Admin dashboard). */
@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const now = Date.now();
    const [
      schoolsByStatus,
      totalStudents,
      totalTeachers,
      totalParents,
      subscriptions,
    ] = await Promise.all([
      this.prisma.school.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.student.count(),
      this.prisma.teacher.count(),
      this.prisma.parent.count(),
      // Who is on a plan, and until when. The console's first question about
      // a school it has just been asked about is whether it is paying.
      this.prisma.schoolSubscription.findMany({
        select: { schoolId: true, status: true, endDate: true },
      }),
    ]);

    const active =
      schoolsByStatus.find((s) => s.status === "ACTIVE")?._count._all ?? 0;
    const suspended =
      schoolsByStatus.find((s) => s.status === "SUSPENDED")?._count._all ?? 0;
    const totalSchools = active + suspended;

    // A plan that ran out yesterday is not "no plan": one is a renewal
    // conversation, the other a sales one, so they are counted apart.
    const live = subscriptions.filter(
      (x) => x.status === "ACTIVE" && x.endDate.getTime() > now,
    );
    const expired = subscriptions.length - live.length;

    return {
      totalSchools,
      activeSchools: active,
      suspendedSchools: suspended,
      totalStudents,
      totalTeachers,
      totalParents,
      subscribedSchools: live.length,
      /** On a plan with a fortnight or less left on it. */
      expiringSchools: live.filter(
        (x) => (x.endDate.getTime() - now) / 86_400_000 <= 14,
      ).length,
      expiredSchools: expired,
      unsubscribedSchools: Math.max(0, totalSchools - subscriptions.length),
    };
  }

  /**
   * One row per school: is it being used, by whom, how recently, and did it
   * hit errors. Built from the audit trail every module already writes, so it
   * reflects real work — not a separate analytics pipeline that could drift.
   */
  async schoolActivity(opts: { days?: number } = {}) {
    const days = Math.min(Math.max(opts.days ?? 7, 1), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      schools,
      byStatus,
      lastPerSchool,
      errorsPerSchool,
      studentsPerSchool,
      subscriptions,
    ] = await Promise.all([
      this.prisma.school.findMany({
        select: {
          id: true,
          name: true,
          subdomain: true,
          city: true,
          region: true,
          status: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
      }),
      // Actions in the window, split by module so "logins" and "real work"
      // can be told apart — a school that only logs in is not really using it.
      this.prisma.auditLog.groupBy({
        by: ["schoolId", "module", "action"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ["schoolId"],
        _max: { createdAt: true },
      }),
      this.prisma.errorLog.groupBy({
        by: ["schoolId"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      // How many children each school actually has on its roll. "Busy" and
      // "big" are different questions, and the owner asks both: a school of
      // forty logging in daily is healthy, a school of nine hundred that has
      // not logged in for a fortnight is the one to ring.
      this.prisma.student.groupBy({
        by: ["schoolId"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
      }),
      // Who is actually on a plan, and until when.
      this.prisma.schoolSubscription.findMany({
        select: {
          schoolId: true,
          status: true,
          endDate: true,
          plan: { select: { name: true } },
        },
      }),
    ]);

    const lastById = new Map(
      lastPerSchool.map((r) => [r.schoolId, r._max.createdAt]),
    );
    const studentsById = new Map(
      studentsPerSchool.map((r) => [r.schoolId, r._count._all]),
    );
    const subById = new Map(subscriptions.map((r) => [r.schoolId, r]));
    const errorsById = new Map(
      errorsPerSchool
        .filter((r) => r.schoolId)
        .map((r) => [r.schoolId as string, r._count._all]),
    );

    // Collapse the per-action groups into per-school tallies.
    const tally = new Map<
      string,
      { logins: number; failedLogins: number; actions: number; modules: Map<string, number> }
    >();
    for (const row of byStatus) {
      const t =
        tally.get(row.schoolId) ??
        { logins: 0, failedLogins: 0, actions: 0, modules: new Map<string, number>() };
      const n = row._count._all;
      if (row.action === "LOGIN") t.logins += n;
      else if (row.action === "LOGIN_FAILED") t.failedLogins += n;
      else {
        t.actions += n;
        t.modules.set(row.module, (t.modules.get(row.module) ?? 0) + n);
      }
      tally.set(row.schoolId, t);
    }

    const now = Date.now();
    const rows = schools.map((s) => {
      const t = tally.get(s.id);
      const lastActiveAt = lastById.get(s.id) ?? null;
      const hoursSince = lastActiveAt
        ? (now - lastActiveAt.getTime()) / 3_600_000
        : null;
      const sub = subById.get(s.id);
      // Expired is its own answer, not "no subscription": a school whose plan
      // ran out yesterday is a renewal conversation, and one that never had a
      // plan is a sales conversation. Calling both "none" loses that.
      const subscription = sub
        ? {
            plan: sub.plan.name,
            status:
              sub.status === "ACTIVE" && sub.endDate.getTime() < now
                ? ("EXPIRED" as const)
                : sub.status,
            endDate: sub.endDate,
            daysLeft: Math.ceil((sub.endDate.getTime() - now) / 86_400_000),
          }
        : null;

      return {
        id: s.id,
        name: s.name,
        subdomain: s.subdomain,
        city: s.city,
        region: s.region,
        status: s.status,
        createdAt: s.createdAt,
        students: studentsById.get(s.id) ?? 0,
        subscription,
        lastActiveAt,
        // A school nobody has touched in a fortnight is the one worth calling.
        activity:
          hoursSince === null
            ? ("never" as const)
            : hoursSince <= 24
              ? ("today" as const)
              : hoursSince <= 24 * 7
                ? ("this_week" as const)
                : hoursSince <= 24 * 30
                  ? ("this_month" as const)
                  : ("dormant" as const),
        logins: t?.logins ?? 0,
        failedLogins: t?.failedLogins ?? 0,
        actions: t?.actions ?? 0,
        errors: errorsById.get(s.id) ?? 0,
        topModules: [...(t?.modules ?? new Map<string, number>()).entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([module, count]) => ({ module, count })),
      };
    });

    return {
      days,
      since,
      totals: {
        schools: rows.length,
        students: rows.reduce((n, r) => n + r.students, 0),
        // On a plan and still inside it — the number the owner is asked for.
        subscribed: rows.filter((r) => r.subscription?.status === "ACTIVE")
          .length,
        expiring: rows.filter(
          (r) =>
            r.subscription?.status === "ACTIVE" &&
            r.subscription.daysLeft <= 14,
        ).length,
        expired: rows.filter((r) => r.subscription?.status === "EXPIRED").length,
        noSubscription: rows.filter((r) => !r.subscription).length,
        activeToday: rows.filter((r) => r.activity === "today").length,
        activeThisWeek: rows.filter((r) =>
          ["today", "this_week"].includes(r.activity),
        ).length,
        dormant: rows.filter((r) => ["dormant", "never"].includes(r.activity))
          .length,
        withErrors: rows.filter((r) => r.errors > 0).length,
      },
      rows,
    };
  }

  /** One school in depth: what was done, by whom, and what broke. */
  async schoolActivityDetail(schoolId: string, opts: { days?: number } = {}) {
    const days = Math.min(Math.max(opts.days ?? 30, 1), 180);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        city: true,
        region: true,
        status: true,
        createdAt: true,
      },
    });
    if (!school) throw new NotFoundException("School not found");

    const [recent, byModule, byUser, errors, counts, failedLoginRows] =
      await Promise.all([
      this.prisma.auditLog.findMany({
        where: { schoolId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          username: true,
          role: true,
          module: true,
          action: true,
          ip: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ["module"],
        where: {
          schoolId,
          createdAt: { gte: since },
          action: { notIn: ["LOGIN", "LOGIN_FAILED"] },
        },
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ["username", "role"],
        where: { schoolId, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.errorLog.findMany({
        where: { schoolId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          method: true,
          path: true,
          statusCode: true,
          message: true,
          role: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ["action"],
        where: {
          schoolId,
          createdAt: { gte: since },
          action: { in: ["LOGIN", "LOGIN_FAILED"] },
        },
        _count: { _all: true },
      }),
      // Who is failing, not just how many times. A hundred and twenty-one
      // failures is a head teacher locked out of their own school or somebody
      // trying the door, and the count alone cannot tell them apart.
      this.prisma.auditLog.findMany({
        where: {
          schoolId,
          createdAt: { gte: since },
          action: "LOGIN_FAILED",
        },
        select: { username: true, role: true, ip: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    // One row per name tried, with the addresses it was tried from: one
    // address over an afternoon is somebody who forgot their password; many
    // addresses, or many names, is not.
    const failedMap = new Map<
      string,
      { username: string; role: string | null; attempts: number; lastAt: Date; ips: Set<string> }
    >();
    for (const f of failedLoginRows) {
      const name = f.username ?? "(no username)";
      const cur =
        failedMap.get(name) ??
        { username: name, role: f.role, attempts: 0, lastAt: f.createdAt, ips: new Set<string>() };
      cur.attempts += 1;
      if (f.createdAt > cur.lastAt) cur.lastAt = f.createdAt;
      if (f.ip) cur.ips.add(f.ip);
      if (!cur.role && f.role) cur.role = f.role;
      failedMap.set(name, cur);
    }
    const failedBy = [...failedMap.values()]
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 10)
      .map((f) => ({
        username: f.username,
        // Null means the name matched no account at all — somebody guessing,
        // or a parent typing their child's code into the staff login.
        role: f.role,
        attempts: f.attempts,
        lastAt: f.lastAt,
        addresses: f.ips.size,
      }));

    const errorsByPath = new Map<string, { count: number; message: string }>();
    for (const e of errors) {
      const key = `${e.method} ${e.path}`;
      const prev = errorsByPath.get(key);
      errorsByPath.set(key, {
        count: (prev?.count ?? 0) + 1,
        message: prev?.message ?? e.message,
      });
    }

    return {
      school,
      days,
      since,
      logins:
        counts.find((c) => c.action === "LOGIN")?._count._all ?? 0,
      failedLogins:
        counts.find((c) => c.action === "LOGIN_FAILED")?._count._all ?? 0,
      failedBy,
      lastActiveAt: recent[0]?.createdAt ?? null,
      lastAction: recent[0]
        ? {
            module: recent[0].module,
            action: recent[0].action,
            username: recent[0].username,
            at: recent[0].createdAt,
          }
        : null,
      modules: byModule
        .map((m) => ({ module: m.module, count: m._count._all }))
        .sort((a, b) => b.count - a.count),
      users: byUser
        .map((u) => ({
          username: u.username,
          role: u.role,
          actions: u._count._all,
          lastActiveAt: u._max.createdAt,
        }))
        .sort((a, b) => b.actions - a.actions),
      errorPaths: [...errorsByPath.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([path, v]) => ({ path, count: v.count, message: v.message })),
      errors,
      recent,
    };
  }

  /**
   * Every unhandled server error (5xx) recorded by AllExceptionsFilter,
   * across all schools — this is the only durable view of what's actually
   * failing in production, since container logs are wiped on every deploy.
   */
  async errorLogs(opts: { schoolId?: string; days?: number; limit?: number }) {
    const since = new Date();
    since.setDate(since.getDate() - (opts.days ?? 7));

    const rows = await this.prisma.errorLog.findMany({
      where: {
        createdAt: { gte: since },
        ...(opts.schoolId ? { schoolId: opts.schoolId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(opts.limit ?? 200, 500),
    });

    const schoolIds = [...new Set(rows.map((r) => r.schoolId).filter((id): id is string => !!id))];
    const schools = schoolIds.length
      ? await this.prisma.school.findMany({
          where: { id: { in: schoolIds } },
          select: { id: true, name: true, subdomain: true },
        })
      : [];
    const schoolById = new Map(schools.map((s) => [s.id, s]));

    const byPath = new Map<string, number>();
    for (const r of rows) {
      const key = `${r.method} ${r.path}`;
      byPath.set(key, (byPath.get(key) ?? 0) + 1);
    }

    return {
      total: rows.length,
      since,
      topPaths: [...byPath.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count })),
      rows: rows.map((r) => ({
        id: r.id,
        schoolId: r.schoolId,
        schoolName: r.schoolId ? (schoolById.get(r.schoolId)?.name ?? null) : null,
        schoolSubdomain: r.schoolId ? (schoolById.get(r.schoolId)?.subdomain ?? null) : null,
        userId: r.userId,
        role: r.role,
        method: r.method,
        path: r.path,
        statusCode: r.statusCode,
        message: r.message,
        stack: r.stack,
        createdAt: r.createdAt,
      })),
    };
  }
}
