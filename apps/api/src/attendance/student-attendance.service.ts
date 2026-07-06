import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { MarkStudentAttendanceInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

@Injectable()
export class StudentAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mark attendance for a section on a date. One record per student per day
   * (re-marking updates). Only ACTIVE students of the section are accepted;
   * others are skipped (inactive/graduated/wrong-section cannot be marked).
   */
  async mark(
    schoolId: string,
    dto: MarkStudentAttendanceInput,
    markedByUserId: string,
  ) {
    const date = parseDate(dto.date);
    const sectionId = dto.sectionId ?? null;

    return this.prisma.forTenant(schoolId, async (tx) => {
      const cls = await tx.class.findFirst({
        where: { id: dto.classId },
        select: { id: true, academicYearId: true },
      });
      if (!cls) throw new BadRequestException("Invalid class");

      const active = await tx.student.findMany({
        where: { classId: dto.classId, sectionId, status: "ACTIVE" },
        select: { id: true },
      });
      const activeIds = new Set(active.map((s) => s.id));

      let marked = 0;
      let skipped = 0;
      for (const rec of dto.records) {
        if (!activeIds.has(rec.studentId)) {
          skipped++;
          continue;
        }
        await tx.studentAttendance.upsert({
          where: {
            schoolId_studentId_date: { schoolId, studentId: rec.studentId, date },
          },
          create: {
            schoolId,
            studentId: rec.studentId,
            classId: dto.classId,
            sectionId,
            academicYearId: cls.academicYearId,
            date,
            status: rec.status,
            markedByUserId,
          },
          update: { status: rec.status, markedByUserId },
        });
        marked++;
      }
      return { date: dto.date, marked, skipped };
    });
  }

  /** Roster for a section on a date: every active student + their status. */
  async list(
    schoolId: string,
    classId: string,
    sectionId: string | null,
    dateStr: string,
  ) {
    const date = parseDate(dateStr);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const students = await tx.student.findMany({
        where: { classId, sectionId, status: "ACTIVE" },
        orderBy: { fullName: "asc" },
        select: { id: true, code: true, fullName: true },
      });
      const records = await tx.studentAttendance.findMany({
        where: { classId, sectionId, date },
        select: { studentId: true, status: true },
      });
      const byStudent = new Map(records.map((r) => [r.studentId, r.status]));
      return {
        date: dateStr,
        roster: students.map((s) => ({
          ...s,
          status: byStudent.get(s.id) ?? null,
        })),
      };
    });
  }

  /** Daily dashboard counts (optionally scoped to a class/section). */
  async dashboard(
    schoolId: string,
    dateStr: string,
    classId?: string,
    sectionId?: string,
  ) {
    const date = parseDate(dateStr);
    const where: Prisma.StudentAttendanceWhereInput = { date };
    if (classId) where.classId = classId;
    if (sectionId) where.sectionId = sectionId;

    return this.prisma.forTenant(schoolId, async (tx) => {
      const grouped = await tx.studentAttendance.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      });
      const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
      for (const g of grouped) counts[g.status] = g._count._all;
      const total =
        counts.PRESENT + counts.ABSENT + counts.LATE + counts.EXCUSED;
      const percentage = total
        ? Math.round(((counts.PRESENT + counts.LATE) / total) * 100)
        : 0;
      return { date: dateStr, ...counts, total, presentPercentage: percentage };
    });
  }
}
