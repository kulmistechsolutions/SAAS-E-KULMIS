import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ExaminationsService } from "../examinations/examinations.service";
import { FeesService } from "../finance/fees.service";
import { TimetableViewService } from "../timetable/timetable-view.service";

@Injectable()
export class ParentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: ExaminationsService,
    private readonly fees: FeesService,
    private readonly timetable: TimetableViewService,
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

  async me(schoolId: string, userId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const parent = await tx.parent.findFirst({
        where: { userId },
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          altPhone: true,
          email: true,
          address: true,
          occupation: true,
          status: true,
          createdAt: true,
        },
      });
      if (!parent) throw new NotFoundException("Parent profile not found");
      return parent;
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

  /**
   * The child's published class timetable.
   *
   * Ownership is re-checked here, exactly like every other child endpoint: a
   * studentId in the URL must never be enough to read another family's data.
   */
  async childTimetable(schoolId: string, studentId: string, userId: string) {
    const parentId = await this.parentIdForUser(schoolId, userId);
    const owned = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findFirst({ where: { id: studentId, parentId }, select: { id: true } }),
    );
    if (!owned) throw new NotFoundException("Child not found");
    return this.timetable.forStudent(schoolId, studentId);
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
