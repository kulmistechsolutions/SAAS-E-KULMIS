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
   * Active shifts for an academic year, for the attendance-marking picker.
   * Kept minimal and open to any staff role — the full shift editor
   * (`/timetable/shifts`) is administrator-only, but everyone who can mark
   * attendance needs to see which shifts exist to pick one.
   */
  async listShifts(schoolId: string, academicYearId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.schoolShift.findMany({
        where: { academicYearId, status: "ACTIVE" },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, orderIndex: true },
      }),
    );
  }

  /**
   * Mark attendance for a section on a date, optionally scoped to a shift.
   * One record per student per day per shift (re-marking the same day+shift
   * updates it). Only ACTIVE students of the section are accepted; others
   * are skipped (inactive/graduated/wrong-section cannot be marked).
   */
  async mark(
    schoolId: string,
    dto: MarkStudentAttendanceInput,
    markedByUserId: string,
  ) {
    const date = parseDate(dto.date);
    const sectionId = dto.sectionId ?? null;
    const shiftId = dto.shiftId ?? null;

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
        const create: Prisma.StudentAttendanceUncheckedCreateInput = {
          schoolId,
          studentId: rec.studentId,
          classId: dto.classId,
          sectionId,
          shiftId,
          academicYearId: cls.academicYearId,
          date,
          status: rec.status,
          markedByUserId,
        };
        // Prisma's compound-unique `where` type requires a non-null shiftId
        // (a known limitation with nullable fields in compound indexes), so
        // the no-shift case falls back to a manual find-then-write — the
        // partial unique index on (schoolId, studentId, date) WHERE shiftId
        // IS NULL still guarantees one row per day at the DB level.
        if (shiftId) {
          await tx.studentAttendance.upsert({
            where: {
              schoolId_studentId_date_shiftId: {
                schoolId,
                studentId: rec.studentId,
                date,
                shiftId,
              },
            },
            create,
            update: { status: rec.status, markedByUserId },
          });
        } else {
          const existing = await tx.studentAttendance.findFirst({
            where: { schoolId, studentId: rec.studentId, date, shiftId: null },
            select: { id: true },
          });
          if (existing) {
            await tx.studentAttendance.update({
              where: { id: existing.id },
              data: { status: rec.status, markedByUserId },
            });
          } else {
            await tx.studentAttendance.create({ data: create });
          }
        }
        marked++;
      }
      return { date: dto.date, marked, skipped };
    });
  }

  /** Roster for a section (+ shift) on a date: every active student + their status. */
  async list(
    schoolId: string,
    classId: string,
    sectionId: string | null,
    dateStr: string,
    shiftId?: string | null,
  ) {
    const date = parseDate(dateStr);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const students = await tx.student.findMany({
        where: { classId, sectionId, status: "ACTIVE" },
        orderBy: { fullName: "asc" },
        select: { id: true, code: true, fullName: true },
      });
      const records = await tx.studentAttendance.findMany({
        where: { classId, sectionId, date, shiftId: shiftId ?? null },
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

  /** Daily dashboard counts (optionally scoped to a class/section/shift). */
  async dashboard(
    schoolId: string,
    dateStr: string,
    classId?: string,
    sectionId?: string,
    shiftId?: string,
  ) {
    const date = parseDate(dateStr);
    const where: Prisma.StudentAttendanceWhereInput = { date };
    if (classId) where.classId = classId;
    if (sectionId) where.sectionId = sectionId;
    if (shiftId) where.shiftId = shiftId;

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
