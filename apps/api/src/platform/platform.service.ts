import { Injectable } from "@nestjs/common";
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
