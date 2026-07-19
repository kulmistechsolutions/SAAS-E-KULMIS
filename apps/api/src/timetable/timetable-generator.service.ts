import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  solveTimetable,
  type SolverBlock,
  type SolverDemand,
  type SolverRoom,
} from "./timetable-solver";

function roomKey(classId: string, sectionId: string | null): string {
  return `${classId}:${sectionId ?? ""}`;
}

/**
 * Turns the school's setup into an actual timetable and stores it.
 *
 * Generation always produces a DRAFT. Publishing is a separate, deliberate step
 * because publishing is what makes the database's anti-clash constraints apply
 * — a school should be able to generate, look, regenerate, and only then commit.
 */
@Injectable()
export class TimetableGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  list(schoolId: string, academicYearId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.timetable.findMany({
        where: { academicYearId },
        orderBy: { createdAt: "desc" },
        include: {
          shift: { select: { id: true, name: true } },
          _count: { select: { entries: true } },
        },
      }),
    );
  }

  /** One timetable with everything needed to draw both grid views. */
  async get(schoolId: string, timetableId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const timetable = await tx.timetable.findUnique({
        where: { id: timetableId },
        include: {
          shift: { include: { periods: { orderBy: { orderIndex: "asc" } } } },
          entries: {
            include: {
              subject: { select: { id: true, name: true } },
              teacher: { select: { id: true, fullName: true } },
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (!timetable) throw new NotFoundException("Timetable not found");
      return timetable;
    });
  }

  /**
   * Build a timetable for one shift.
   *
   * Reading happens in a tenant transaction, solving happens outside it. The
   * solver can spend fifteen seconds thinking, and holding a database
   * transaction open that long against a remote pooler is how you collect
   * timeouts.
   */
  async generate(schoolId: string, academicYearId: string, shiftId: string) {
    const data = await this.prisma.forTenant(schoolId, async (tx) => {
      const shift = await tx.schoolShift.findUnique({
        where: { id: shiftId },
        include: { periods: { orderBy: { orderIndex: "asc" } } },
      });
      if (!shift) throw new NotFoundException("Shift not found");

      const [classes, loads, assignments, unavailable, otherEntries] =
        await Promise.all([
          tx.class.findMany({
            where: { academicYearId, status: "ACTIVE" },
            orderBy: { orderIndex: "asc" },
            include: {
              sections: { where: { status: "ACTIVE" }, orderBy: { name: "asc" } },
            },
          }),
          tx.subjectLoad.findMany({
            where: { academicYearId },
            include: { subject: { select: { id: true, name: true } } },
          }),
          tx.teacherAssignment.findMany({
            where: { academicYearId },
            include: { teacher: { select: { id: true, fullName: true } } },
          }),
          tx.teacherUnavailability.findMany(),
          // Published lessons from the school's OTHER shifts. A teacher who
          // works both must not be booked twice, and the only sound way to
          // compare a morning slot with an afternoon one is wall-clock time.
          tx.timetableEntry.findMany({
            where: { isActive: true, timetable: { shiftId: { not: shiftId } } },
            select: {
              teacherId: true,
              dayOfWeek: true,
              startMinute: true,
              endMinute: true,
            },
          }),
        ]);

      return { shift, classes, loads, assignments, unavailable, otherEntries };
    });

    const { shift, classes, loads, assignments, unavailable, otherEntries } = data;

    const teaching = shift.periods.filter((p) => !p.isBreak);
    if (teaching.length === 0 || shift.days.length === 0) {
      throw new BadRequestException(
        "This shift has no teaching periods or no working days.",
      );
    }

    // Only classrooms that actually attend in this shift. A class with no shift
    // set falls into the first one, which is what a single-shift school means.
    const allRooms = classes.flatMap((c) =>
      c.sections.length > 0
        ? c.sections.map((s) => ({
            key: roomKey(c.id, s.id),
            classId: c.id,
            sectionId: s.id as string | null,
            label: `${c.name} ${s.name}`,
            shiftId: s.shiftId ?? c.shiftId,
          }))
        : [
            {
              key: roomKey(c.id, null),
              classId: c.id,
              sectionId: null as string | null,
              label: c.name,
              shiftId: c.shiftId,
            },
          ],
    );
    const rooms: SolverRoom[] = allRooms
      .filter((r) => r.shiftId === shiftId || r.shiftId === null)
      .map(({ key, classId, sectionId, label }) => ({
        key,
        classId,
        sectionId,
        label,
      }));

    if (rooms.length === 0) {
      throw new BadRequestException(
        "No class is assigned to this shift, so there is nothing to schedule.",
      );
    }

    const roomKeys = new Set(rooms.map((r) => r.key));
    const demands: SolverDemand[] = [];
    for (const load of loads) {
      const key = roomKey(load.classId, load.sectionId);
      if (!roomKeys.has(key) || load.periodsPerWeek <= 0) continue;
      const assignment =
        assignments.find(
          (a) =>
            a.classId === load.classId &&
            a.subjectId === load.subjectId &&
            (a.sectionId ?? null) === (load.sectionId ?? null),
        ) ??
        assignments.find(
          (a) =>
            a.classId === load.classId &&
            a.subjectId === load.subjectId &&
            a.sectionId === null,
        );
      if (!assignment) {
        throw new BadRequestException(
          `${load.subject.name} has periods allocated but no teacher assigned. Run the check on the setup page.`,
        );
      }
      demands.push({
        roomKey: key,
        subjectId: load.subjectId,
        subjectName: load.subject.name,
        teacherId: assignment.teacherId,
        teacherName: assignment.teacher.fullName,
        periodsPerWeek: load.periodsPerWeek,
      });
    }

    const blocks: SolverBlock[] = [
      ...unavailable.map((u) => ({
        teacherId: u.teacherId,
        dayOfWeek: u.dayOfWeek,
        startMinute: u.startMinute,
        endMinute: u.endMinute,
      })),
      ...otherEntries
        .filter((e): e is typeof e & { teacherId: string } => e.teacherId !== null)
        .map((e) => ({
          teacherId: e.teacherId,
          dayOfWeek: e.dayOfWeek,
          startMinute: e.startMinute,
          endMinute: e.endMinute,
        })),
    ];

    const solved = solveTimetable({
      days: shift.days,
      periods: teaching.map((p) => ({
        id: p.id,
        startMinute: p.startMinute,
        endMinute: p.endMinute,
      })),
      rooms,
      demands,
      blocks,
      timeLimitMs: 20000,
    });

    if (!solved.ok) {
      throw new ConflictException(solved.failure ?? "Could not build a timetable.");
    }

    const roomByKey = new Map(rooms.map((r) => [r.key, r]));
    const created = await this.prisma.forTenant(
      schoolId,
      async (tx) => {
        const timetable = await tx.timetable.create({
          data: {
            schoolId,
            academicYearId,
            shiftId,
            name: `${shift.name} — ${new Date().toISOString().slice(0, 10)}`,
            status: "DRAFT",
            generatedAt: new Date(),
            notes: solved.notes.join("\n") || null,
          },
        });

        await tx.timetableEntry.createMany({
          data: solved.lessons.map((l) => {
            const room = roomByKey.get(l.roomKey)!;
            const period = teaching[l.periodIndex]!;
            return {
              schoolId,
              timetableId: timetable.id,
              classId: room.classId,
              sectionId: room.sectionId,
              subjectId: l.subjectId,
              teacherId: l.teacherId,
              shiftPeriodId: period.id,
              dayOfWeek: shift.days[l.dayIndex]!,
              startMinute: period.startMinute,
              endMinute: period.endMinute,
              // Drafts stay inactive so the exclusion constraints do not apply
              // until the school actually publishes.
              isActive: false,
            };
          }),
        });

        return timetable;
      },
      { timeout: 20000 },
    );

    return {
      timetableId: created.id,
      lessons: solved.lessons.length,
      notes: solved.notes,
      attempts: solved.attempts,
    };
  }

  /**
   * Make a draft live. Any previously published timetable for the same shift is
   * archived first, so a shift only ever has one active grid.
   */
  async publish(schoolId: string, timetableId: string) {
    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
        const timetable = await tx.timetable.findUnique({
          where: { id: timetableId },
        });
        if (!timetable) throw new NotFoundException("Timetable not found");

        const previous = await tx.timetable.findMany({
          where: {
            shiftId: timetable.shiftId,
            status: "PUBLISHED",
            id: { not: timetableId },
          },
          select: { id: true },
        });
        if (previous.length > 0) {
          const ids = previous.map((p) => p.id);
          // Deactivate the old entries BEFORE activating the new ones, or the
          // two would collide on the very constraints that keep them honest.
          await tx.timetableEntry.updateMany({
            where: { timetableId: { in: ids } },
            data: { isActive: false },
          });
          await tx.timetable.updateMany({
            where: { id: { in: ids } },
            data: { status: "ARCHIVED" },
          });
        }

        await tx.timetableEntry.updateMany({
          where: { timetableId },
          data: { isActive: true },
        });
        await tx.timetable.update({
          where: { id: timetableId },
          data: { status: "PUBLISHED" },
        });

        return { success: true };
      },
      { timeout: 20000 },
    ).catch((e: unknown) => {
      // The database rejects a clash the application somehow let through. That
      // is the safety net working, so translate it rather than leaking SQL.
      const message = e instanceof Error ? e.message : "";
      if (message.includes("timetable_entries_teacher_no_overlap")) {
        throw new ConflictException(
          "A teacher in this timetable is already teaching at the same time in another published shift. Regenerate before publishing.",
        );
      }
      if (message.includes("timetable_entries_class_no_overlap")) {
        throw new ConflictException(
          "A class in this timetable is already scheduled at the same time in another published shift.",
        );
      }
      throw e;
    });
  }

  async remove(schoolId: string, timetableId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      await tx.timetable.delete({ where: { id: timetableId } });
      return { success: true };
    });
  }
}
