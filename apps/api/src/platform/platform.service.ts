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
}
