import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { MarkStudentAttendanceInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { studentInClassWhere } from "../students/student-class.util";

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/** The times a school set in Settings → Attendance. */
interface AttendanceRules {
  lockTime: string;
  excusedEnabled: boolean;
}

/** "HH:MM" → minutes since midnight, or null if it isn't a time. */
function minutesOfDay(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Today's date and clock reading in a school's OWN timezone. Attendance times
 * are wall-clock ("lock at 16:00") and mean 4pm where the school is, not on
 * whichever server happens to be running this.
 */
function schoolNow(timezone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

@Injectable()
export class StudentAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A school's attendance rules, or null when it has never saved that page.
   *
   * Null means "do not enforce". These defaults ship switched on in the UI,
   * so treating an untouched page as a live rule would start blocking
   * schools from marking a register on a policy nobody chose. A saved
   * section is a decision; an unsaved one is not.
   */
  private async rulesFor(
    schoolId: string,
  ): Promise<{ rules: AttendanceRules; timezone: string } | null> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { attendanceSettings: true, timezone: true },
    });
    const stored = school?.attendanceSettings as Partial<AttendanceRules> | null;
    if (!stored) return null;
    return {
      rules: {
        lockTime: stored.lockTime ?? "23:59",
        excusedEnabled: stored.excusedEnabled ?? true,
      },
      timezone: school?.timezone || "UTC",
    };
  }

  /**
   * Apply the school's own attendance rules to one marking request.
   *
   * Administrators are exempt from the lock on purpose: it exists to stop a
   * register being quietly rewritten after the day closes, not to leave a
   * school unable to correct a mistake. Without that valve a mis-set lock
   * time would strand them until someone changed a setting they may not
   * know exists.
   */
  private async assertMarkingAllowed(
    schoolId: string,
    dateStr: string,
    statuses: string[],
    role: string | undefined,
  ): Promise<void> {
    const policy = await this.rulesFor(schoolId);
    if (!policy) return;
    const { rules, timezone } = policy;

    if (!rules.excusedEnabled && statuses.includes("EXCUSED")) {
      throw new BadRequestException(
        "Excused attendance is switched off for this school (Settings → Attendance).",
      );
    }

    if (role === "ADMINISTRATOR") return;
    const lock = minutesOfDay(rules.lockTime);
    if (lock === null) return;

    const now = schoolNow(timezone);
    const lockedOut =
      dateStr < now.date || (dateStr === now.date && now.minutes >= lock);
    if (lockedOut) {
      throw new BadRequestException(
        `Attendance for ${dateStr} is locked (after ${rules.lockTime}). Ask an administrator to change it.`,
      );
    }
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
    role?: string,
  ) {
    await this.assertMarkingAllowed(
      schoolId,
      dto.date,
      dto.records.map((r) => r.status),
      role,
    );
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
        where: {
          ...studentInClassWhere(dto.classId, sectionId),
          status: "ACTIVE",
        },
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
      const records = await tx.studentAttendance.findMany({
        where: { classId, sectionId, date, shiftId: shiftId ?? null },
        select: { studentId: true, status: true },
      });

      // Whose register this is depends on the class's year, not on whether
      // anything has been marked yet. In the current year the roll is the
      // class as it stands — a half-marked day must still list everyone left
      // to mark. In a year that has ended the class has been refilled by the
      // one below, so the register belongs to whoever was marked in it.
      const cls = await tx.class.findFirst({
        where: { id: classId },
        select: { academicYear: { select: { isActive: true } } },
      });
      const currentYear = cls?.academicYear.isActive ?? true;
      const markedIds = records.map((r) => r.studentId);
      const students = await tx.student.findMany({
        where: currentYear
          ? { ...studentInClassWhere(classId, sectionId), status: "ACTIVE" }
          : { id: { in: markedIds } },
        orderBy: { fullName: "asc" },
        select: { id: true, code: true, fullName: true, gender: true },
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
