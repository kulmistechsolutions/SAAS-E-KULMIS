import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Platform-wide analytics across ALL tenants (Super Admin dashboard). */
@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [schoolsByStatus, totalStudents, totalTeachers, totalParents] =
      await Promise.all([
        this.prisma.school.groupBy({ by: ["status"], _count: { _all: true } }),
        this.prisma.student.count(),
        this.prisma.teacher.count(),
        this.prisma.parent.count(),
      ]);

    const active =
      schoolsByStatus.find((s) => s.status === "ACTIVE")?._count._all ?? 0;
    const suspended =
      schoolsByStatus.find((s) => s.status === "SUSPENDED")?._count._all ?? 0;

    return {
      totalSchools: active + suspended,
      activeSchools: active,
      suspendedSchools: suspended,
      totalStudents,
      totalTeachers,
      totalParents,
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

    const [schools, byStatus, lastPerSchool, errorsPerSchool] = await Promise.all([
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
    ]);

    const lastById = new Map(
      lastPerSchool.map((r) => [r.schoolId, r._max.createdAt]),
    );
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
      return {
        id: s.id,
        name: s.name,
        subdomain: s.subdomain,
        city: s.city,
        region: s.region,
        status: s.status,
        createdAt: s.createdAt,
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

    const [recent, byModule, byUser, errors, counts] = await Promise.all([
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
    ]);

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
