import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** A timetable as the portals show it: one week, already resolved. */
export interface PersonalTimetable {
  title: string;
  shiftName: string;
  days: number[];
  periods: {
    id: string;
    name: string;
    startMinute: number;
    endMinute: number;
    isBreak: boolean;
  }[];
  lessons: {
    dayOfWeek: number;
    shiftPeriodId: string;
    subject: string;
    /** The class for a teacher's view, the teacher for a student's. */
    detail: string;
  }[];
}

/**
 * Read-only timetable views for teachers, parents and students.
 *
 * Only PUBLISHED timetables are ever returned. A draft is the school working
 * something out; showing it to a parent would have families turning up for
 * lessons that were never agreed.
 */
@Injectable()
export class TimetableViewService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every published lesson this teacher has, across both shifts. */
  async forTeacher(schoolId: string, userId: string): Promise<PersonalTimetable[]> {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const teacher = await tx.teacher.findFirst({
        where: { userId },
        select: { id: true, fullName: true },
      });
      if (!teacher) throw new NotFoundException("Teacher profile not found");

      const entries = await tx.timetableEntry.findMany({
        where: { teacherId: teacher.id, isActive: true },
        include: {
          subject: { select: { name: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
          timetable: {
            include: {
              shift: { include: { periods: { orderBy: { orderIndex: "asc" } } } },
            },
          },
        },
      });

      // A teacher may work a morning and an afternoon shift, and the two have
      // different period grids — so they cannot share one table.
      return groupByShift(entries, (e) =>
        e.section ? `${e.class.name} ${e.section.name}` : e.class.name,
      ).map((g) => ({ ...g, title: teacher.fullName }));
    });
  }

  /** The published timetable for one student's classroom. */
  async forStudent(schoolId: string, studentId: string): Promise<PersonalTimetable[]> {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: {
          fullName: true,
          classId: true,
          sectionId: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      });
      if (!student) throw new NotFoundException("Student not found");

      const entries = await tx.timetableEntry.findMany({
        where: {
          isActive: true,
          classId: student.classId,
          // A whole-class lesson counts for every section of that class.
          OR: [{ sectionId: student.sectionId }, { sectionId: null }],
        },
        include: {
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
          timetable: {
            include: {
              shift: { include: { periods: { orderBy: { orderIndex: "asc" } } } },
            },
          },
        },
      });

      const label = student.section
        ? `${student.class?.name ?? ""} ${student.section.name}`.trim()
        : (student.class?.name ?? "");
      return groupByShift(entries, (e) => e.teacher?.fullName ?? "—").map((g) => ({
        ...g,
        title: label,
      }));
    });
  }
}

type EntryWithShift = {
  dayOfWeek: number;
  shiftPeriodId: string;
  subject: { name: string };
  timetable: {
    shift: {
      name: string;
      days: number[];
      periods: {
        id: string;
        name: string;
        startMinute: number;
        endMinute: number;
        isBreak: boolean;
        orderIndex: number;
      }[];
    };
  };
};

function groupByShift<T extends EntryWithShift>(
  entries: T[],
  detailOf: (e: T) => string,
): PersonalTimetable[] {
  const byShift = new Map<string, T[]>();
  for (const e of entries) {
    const key = e.timetable.shift.name;
    const list = byShift.get(key);
    if (list) list.push(e);
    else byShift.set(key, [e]);
  }

  return [...byShift.entries()].map(([shiftName, list]) => {
    const shift = list[0]!.timetable.shift;
    return {
      title: "",
      shiftName,
      days: shift.days,
      periods: shift.periods.map((p) => ({
        id: p.id,
        name: p.name,
        startMinute: p.startMinute,
        endMinute: p.endMinute,
        isBreak: p.isBreak,
      })),
      lessons: list.map((e) => ({
        dayOfWeek: e.dayOfWeek,
        shiftPeriodId: e.shiftPeriodId,
        subject: e.subject.name,
        detail: detailOf(e),
      })),
    };
  });
}
