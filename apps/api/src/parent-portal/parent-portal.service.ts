import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ExaminationsService } from "../examinations/examinations.service";
import { FeesService } from "../finance/fees.service";

@Injectable()
export class ParentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: ExaminationsService,
    private readonly fees: FeesService,
  ) {}

  private async parentIdForUser(schoolId: string, userId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const parent = await tx.parent.findFirst({
        where: { userId },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException("Parent profile not found");
      return parent.id;
    });
  }

  async children(schoolId: string, userId: string) {
    const parentId = await this.parentIdForUser(schoolId, userId);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findMany({
        where: { parentId, status: { in: ["ACTIVE", "GRADUATED"] } },
        include: {
          class: { select: { name: true, academicYear: { select: { name: true } } } },
          section: { select: { name: true } },
        },
      }),
    );
  }

  async childAttendance(schoolId: string, studentId: string, userId: string) {
    const parentId = await this.parentIdForUser(schoolId, userId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, parentId },
      });
      if (!student) throw new NotFoundException("Child not found");
      return tx.studentAttendance.findMany({
        where: { studentId },
        orderBy: { date: "desc" },
        take: 60,
      });
    });
  }

  async childFees(schoolId: string, studentId: string, userId: string) {
    const parentId = await this.parentIdForUser(schoolId, userId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, parentId },
      });
      if (!student) throw new NotFoundException("Child not found");
      return this.fees.ledger(schoolId, studentId);
    });
  }

  async childResults(schoolId: string, studentId: string, userId: string) {
    const parentId = await this.parentIdForUser(schoolId, userId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, parentId },
        select: { id: true },
      });
      if (!student) throw new NotFoundException("Child not found");
      return this.exams.studentResults(schoolId, studentId);
    });
  }
}
