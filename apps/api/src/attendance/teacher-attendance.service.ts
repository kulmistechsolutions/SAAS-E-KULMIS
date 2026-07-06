import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { MarkTeacherAttendanceInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

@Injectable()
export class TeacherAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mark teacher attendance for a shift on a date. Only ACTIVE teachers of that
   * shift are accepted (a teacher never appears in the other shift). One record
   * per teacher per day (re-marking updates).
   */
  async mark(
    schoolId: string,
    dto: MarkTeacherAttendanceInput,
    markedByUserId: string,
  ) {
    const date = parseDate(dto.date);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const eligible = await tx.teacher.findMany({
        where: { shift: dto.shift, status: "ACTIVE" },
        select: { id: true },
      });
      const eligibleIds = new Set(eligible.map((t) => t.id));

      let marked = 0;
      let skipped = 0;
      for (const rec of dto.records) {
        if (!eligibleIds.has(rec.teacherId)) {
          skipped++;
          continue;
        }
        await tx.teacherAttendance.upsert({
          where: {
            schoolId_teacherId_date: { schoolId, teacherId: rec.teacherId, date },
          },
          create: {
            schoolId,
            teacherId: rec.teacherId,
            shift: dto.shift,
            date,
            status: rec.status,
            markedByUserId,
          },
          update: { status: rec.status, markedByUserId },
        });
        marked++;
      }
      return { date: dto.date, shift: dto.shift, marked, skipped };
    });
  }

  /** Roster for a shift on a date: every active teacher + their status. */
  async list(schoolId: string, shift: string, dateStr: string) {
    const date = parseDate(dateStr);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const teachers = await tx.teacher.findMany({
        where: { shift: shift as never, status: "ACTIVE" },
        orderBy: { fullName: "asc" },
        select: { id: true, code: true, fullName: true, shift: true },
      });
      const records = await tx.teacherAttendance.findMany({
        where: { shift: shift as never, date },
        select: { teacherId: true, status: true },
      });
      const byTeacher = new Map(records.map((r) => [r.teacherId, r.status]));
      return {
        date: dateStr,
        shift,
        roster: teachers.map((t) => ({
          ...t,
          status: byTeacher.get(t.id) ?? null,
        })),
      };
    });
  }

  async dashboard(schoolId: string, dateStr: string, shift?: string) {
    const date = parseDate(dateStr);
    const where: Prisma.TeacherAttendanceWhereInput = { date };
    if (shift) where.shift = shift as never;

    return this.prisma.forTenant(schoolId, async (tx) => {
      const grouped = await tx.teacherAttendance.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      });
      const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
      for (const g of grouped) counts[g.status] = g._count._all;
      const total =
        counts.PRESENT + counts.ABSENT + counts.LATE + counts.EXCUSED;
      const rate = total
        ? Math.round(((counts.PRESENT + counts.LATE) / total) * 100)
        : 0;
      return { date: dateStr, shift: shift ?? "ALL", ...counts, total, attendanceRate: rate };
    });
  }
}
