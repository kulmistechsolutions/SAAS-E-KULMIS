import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AssignShiftInput,
  ClassFeasibility,
  FeasibilityIssue,
  FeasibilityReport,
  SaveShiftInput,
  SaveSubjectLoadsInput,
  SaveTeacherUnavailabilityInput,
  TeacherFeasibility,
} from "@ekulmis/shared";
import { formatMinutes } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

/** Key for a classroom, which is a section when one exists and the class itself
 *  otherwise. Used to line up allocation rows with capacity. */
function roomKey(classId: string, sectionId: string | null): string {
  return `${classId}:${sectionId ?? ""}`;
}

/**
 * Everything a school sets up BEFORE a timetable can be generated: shifts and
 * their period grid, the weekly lesson allocation, teacher unavailability, and
 * the feasibility check that has to pass first.
 *
 * The feasibility check is the point of this service. Timetabling fails in ways
 * that are almost impossible to explain after the fact ("why is Chemistry only
 * twice?"), so every arithmetic contradiction is surfaced here, in the school's
 * own terms, before a solver is ever asked to do the impossible.
 */
@Injectable()
export class TimetableSetupService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Shifts ───────────────────────────────────────────────────────────────

  listShifts(schoolId: string, academicYearId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.schoolShift.findMany({
        where: { academicYearId },
        orderBy: { orderIndex: "asc" },
        include: { periods: { orderBy: { orderIndex: "asc" } } },
      }),
    );
  }

  /** Create or replace a shift together with its whole period grid. */
  async saveShift(schoolId: string, dto: SaveShiftInput, shiftId?: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      if (shiftId) {
        const existing = await tx.schoolShift.findFirst({
          where: { id: shiftId },
        });
        if (!existing) throw new NotFoundException("Shift not found");
      }

      const count = await tx.schoolShift.count({ where: { academicYearId: dto.academicYearId } });
      const shift = shiftId
        ? await tx.schoolShift.update({
            where: { id: shiftId },
            data: { name: dto.name, days: dto.days },
          })
        : await tx.schoolShift.create({
            data: {
              schoolId,
              academicYearId: dto.academicYearId,
              name: dto.name,
              days: dto.days,
              orderIndex: count,
            },
          });

      // The grid is replaced wholesale rather than diffed: periods have no
      // meaning apart from their position, and a partial update could leave a
      // gap or an overlap mid-save.
      await tx.shiftPeriod.deleteMany({ where: { shiftId: shift.id } });
      await tx.shiftPeriod.createMany({
        data: dto.periods
          .slice()
          .sort((a, b) => a.startMinute - b.startMinute)
          .map((p, i) => ({
            schoolId,
            shiftId: shift.id,
            name: p.name,
            orderIndex: i,
            startMinute: p.startMinute,
            endMinute: p.endMinute,
            isBreak: p.isBreak,
          })),
      });

      return tx.schoolShift.findUnique({
        where: { id: shift.id },
        include: { periods: { orderBy: { orderIndex: "asc" } } },
      });
    });
  }

  async deleteShift(schoolId: string, shiftId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const timetables = await tx.timetable.count({ where: { shiftId } });
      if (timetables > 0) {
        throw new BadRequestException(
          "This shift already has timetables. Delete those first.",
        );
      }
      await tx.schoolShift.delete({ where: { id: shiftId } });
      return { success: true };
    });
  }

  /** Put a class or a section into a shift. */
  async assignShift(schoolId: string, dto: AssignShiftInput) {
    if (!dto.classId && !dto.sectionId) {
      throw new BadRequestException("Pass either a class or a section");
    }
    return this.prisma.forTenant(schoolId, async (tx) => {
      if (dto.sectionId) {
        await tx.section.update({
          where: { id: dto.sectionId },
          data: { shiftId: dto.shiftId },
        });
      } else {
        await tx.class.update({
          where: { id: dto.classId },
          data: { shiftId: dto.shiftId },
        });
      }
      return { success: true };
    });
  }

  // ── Lesson allocation ────────────────────────────────────────────────────

  /**
   * The allocation grid, pre-filled from what the school already maintains:
   * ClassSubject says which subjects a classroom takes, TeacherAssignment says
   * who teaches them. Only the weekly count is genuinely new information, so
   * that is all the admin has to type.
   */
  async getAllocationGrid(schoolId: string, academicYearId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [classes, classSubjects, assignments, loads] = await Promise.all([
        tx.class.findMany({
          where: { academicYearId, status: "ACTIVE" },
          orderBy: { orderIndex: "asc" },
          include: {
            sections: { where: { status: "ACTIVE" }, orderBy: { name: "asc" } },
          },
        }),
        tx.classSubject.findMany({
          where: { academicYearId },
          include: { subject: true },
        }),
        tx.teacherAssignment.findMany({
          where: { academicYearId },
          include: { teacher: { select: { id: true, fullName: true } } },
        }),
        tx.subjectLoad.findMany({ where: { academicYearId } }),
      ]);

      const loadBy = new Map(
        loads.map((l) => [
          `${roomKey(l.classId, l.sectionId)}:${l.subjectId}`,
          l.periodsPerWeek,
        ]),
      );
      // A teacher assigned at whole-class level also covers each section, so
      // fall back to the class-level row when a section has no explicit one.
      const teacherBy = new Map<string, { id: string; fullName: string }>();
      for (const a of assignments) {
        teacherBy.set(`${roomKey(a.classId, a.sectionId)}:${a.subjectId}`, a.teacher);
      }

      const rooms = classes.flatMap((c) =>
        c.sections.length > 0
          ? c.sections.map((s) => ({
              classId: c.id,
              sectionId: s.id as string | null,
              label: `${c.name} ${s.name}`,
              shiftId: s.shiftId ?? c.shiftId,
            }))
          : [
              {
                classId: c.id,
                sectionId: null as string | null,
                label: c.name,
                shiftId: c.shiftId,
              },
            ],
      );

      return {
        rooms: rooms.map((room) => {
          const subjects = classSubjects
            .filter(
              (cs) =>
                cs.classId === room.classId &&
                (cs.sectionId === room.sectionId || cs.sectionId === null),
            )
            // A class-level and a section-level row for the same subject would
            // otherwise appear twice in the grid.
            .filter(
              (cs, i, arr) =>
                arr.findIndex((o) => o.subjectId === cs.subjectId) === i,
            );
          return {
            ...room,
            subjects: subjects.map((cs) => {
              const key = `${roomKey(room.classId, room.sectionId)}:${cs.subjectId}`;
              const classKey = `${roomKey(room.classId, null)}:${cs.subjectId}`;
              const teacher = teacherBy.get(key) ?? teacherBy.get(classKey) ?? null;
              return {
                subjectId: cs.subjectId,
                subjectName: cs.subject.name,
                teacherId: teacher?.id ?? null,
                teacherName: teacher?.fullName ?? null,
                periodsPerWeek: loadBy.get(key) ?? 0,
              };
            }),
          };
        }),
      };
    });
  }

  /** Replace the allocation grid in one transaction. */
  async saveSubjectLoads(schoolId: string, dto: SaveSubjectLoadsInput) {
    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
        await tx.subjectLoad.deleteMany({
          where: { academicYearId: dto.academicYearId },
        });
        const rows = dto.rows.filter((r) => r.periodsPerWeek > 0);
        if (rows.length > 0) {
          await tx.subjectLoad.createMany({
            data: rows.map((r) => ({
              schoolId,
              academicYearId: dto.academicYearId,
              classId: r.classId,
              sectionId: r.sectionId ?? null,
              subjectId: r.subjectId,
              periodsPerWeek: r.periodsPerWeek,
            })),
          });
        }
        return { success: true, saved: rows.length };
      },
      // A whole-school grid is a few hundred rows; the remote pooler is slow
      // enough that the default transaction window is not comfortable.
      { timeout: 20000 },
    );
  }

  // ── Teacher unavailability ───────────────────────────────────────────────

  listUnavailability(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.teacherUnavailability.findMany({
        orderBy: [{ teacherId: "asc" }, { dayOfWeek: "asc" }, { startMinute: "asc" }],
      }),
    );
  }

  async saveUnavailability(
    schoolId: string,
    dto: SaveTeacherUnavailabilityInput,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      await tx.teacherUnavailability.deleteMany({
        where: { teacherId: dto.teacherId },
      });
      if (dto.windows.length > 0) {
        await tx.teacherUnavailability.createMany({
          data: dto.windows.map((w) => ({
            schoolId,
            teacherId: dto.teacherId,
            dayOfWeek: w.dayOfWeek,
            startMinute: w.startMinute,
            endMinute: w.endMinute,
            reason: w.reason ?? null,
          })),
        });
      }
      return { success: true, saved: dto.windows.length };
    });
  }

  // ── Feasibility ──────────────────────────────────────────────────────────

  /**
   * Prove the timetable is arithmetically possible before generating it.
   *
   * Deliberately reports every issue rather than stopping at the first: a
   * school fixing its setup wants the whole list, not one error per round trip.
   */
  async checkFeasibility(
    schoolId: string,
    academicYearId: string,
  ): Promise<FeasibilityReport> {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [shifts, classes, loads, assignments, unavailable, teachers] =
        await Promise.all([
          tx.schoolShift.findMany({
            where: { academicYearId, status: "ACTIVE" },
            include: { periods: true },
          }),
          tx.class.findMany({
            where: { academicYearId, status: "ACTIVE" },
            include: { sections: { where: { status: "ACTIVE" } } },
          }),
          tx.subjectLoad.findMany({
            where: { academicYearId },
            include: { subject: { select: { name: true } } },
          }),
          tx.teacherAssignment.findMany({
            where: { academicYearId },
            include: { teacher: { select: { id: true, fullName: true } } },
          }),
          tx.teacherUnavailability.findMany(),
          tx.teacher.findMany({ select: { id: true, fullName: true } }),
        ]);

      const issues: FeasibilityIssue[] = [];

      if (shifts.length === 0) {
        issues.push({
          level: "BLOCKER",
          code: "NO_SHIFT",
          message: "No shift has been set up yet.",
        });
        return { ok: false, issues, classes: [], teachers: [] };
      }

      const shiftById = new Map(shifts.map((s) => [s.id, s]));
      const teachingPeriods = (shiftId: string | null) => {
        const s = shiftId ? shiftById.get(shiftId) : shifts[0];
        return (s?.periods ?? []).filter((p) => !p.isBreak);
      };
      const workingDays = (shiftId: string | null) => {
        const s = shiftId ? shiftById.get(shiftId) : shifts[0];
        return s?.days ?? [];
      };

      for (const s of shifts) {
        if (s.periods.filter((p) => !p.isBreak).length === 0) {
          issues.push({
            level: "BLOCKER",
            code: "NO_PERIODS",
            message: `Shift "${s.name}" has no teaching periods.`,
          });
        }
      }

      // ── Per classroom: does the week's allocation fit the week's slots? ──
      const rooms = classes.flatMap((c) =>
        c.sections.length > 0
          ? c.sections.map((s) => ({
              classId: c.id,
              sectionId: s.id as string | null,
              label: `${c.name} ${s.name}`,
              shiftId: s.shiftId ?? c.shiftId,
            }))
          : [
              {
                classId: c.id,
                sectionId: null as string | null,
                label: c.name,
                shiftId: c.shiftId,
              },
            ],
      );

      const classReport: ClassFeasibility[] = [];
      for (const room of rooms) {
        const days = workingDays(room.shiftId).length;
        const slots = teachingPeriods(room.shiftId).length;
        const capacity = days * slots;
        const mine = loads.filter(
          (l) =>
            l.classId === room.classId &&
            (l.sectionId ?? null) === room.sectionId,
        );
        const allocated = mine.reduce((sum, l) => sum + l.periodsPerWeek, 0);
        classReport.push({ ...room, capacity, allocated });

        if (allocated > capacity) {
          issues.push({
            level: "BLOCKER",
            code: "CLASS_OVER_ALLOCATED",
            message: `${room.label}: ${allocated} periods allocated but only ${capacity} slots a week — remove ${allocated - capacity}.`,
            classId: room.classId,
            sectionId: room.sectionId,
          });
        } else if (allocated < capacity) {
          issues.push({
            level: "WARNING",
            code: "CLASS_UNDER_ALLOCATED",
            message: `${room.label}: ${allocated} of ${capacity} slots filled — ${capacity - allocated} will be free periods.`,
            classId: room.classId,
            sectionId: room.sectionId,
          });
        }

        // A subject needing more periods than there are days must repeat within
        // a day. Legal, but it is the school's own spread rule bending, so say
        // so now rather than letting them discover it on the printed grid.
        for (const l of mine) {
          if (days > 0 && l.periodsPerWeek > days) {
            issues.push({
              level: "WARNING",
              code: "SUBJECT_EXCEEDS_DAYS",
              message: `${room.label} · ${l.subject.name}: ${l.periodsPerWeek} periods across ${days} days, so it must appear twice on some day.`,
              classId: room.classId,
              sectionId: room.sectionId,
              subjectId: l.subjectId,
            });
          }
        }

        // Allocation without a teacher cannot be scheduled at all.
        for (const l of mine) {
          const hasTeacher = assignments.some(
            (a) =>
              a.classId === l.classId &&
              a.subjectId === l.subjectId &&
              ((a.sectionId ?? null) === (l.sectionId ?? null) ||
                a.sectionId === null),
          );
          if (!hasTeacher) {
            issues.push({
              level: "BLOCKER",
              code: "SUBJECT_WITHOUT_TEACHER",
              message: `${room.label} · ${l.subject.name} has periods allocated but no teacher assigned.`,
              classId: room.classId,
              sectionId: room.sectionId,
              subjectId: l.subjectId,
            });
          }
        }
      }

      // ── Per teacher: does their total load fit the slots they can work? ──
      const teacherName = new Map(teachers.map((t) => [t.id, t.fullName]));
      const loadByTeacher = new Map<string, number>();
      for (const l of loads) {
        const a = assignments.find(
          (x) =>
            x.classId === l.classId &&
            x.subjectId === l.subjectId &&
            ((x.sectionId ?? null) === (l.sectionId ?? null) ||
              x.sectionId === null),
        );
        if (!a) continue;
        loadByTeacher.set(
          a.teacherId,
          (loadByTeacher.get(a.teacherId) ?? 0) + l.periodsPerWeek,
        );
      }

      // Available slots span EVERY shift, because a teacher may work both.
      const allSlots: { day: number; start: number; end: number }[] = [];
      for (const s of shifts) {
        for (const day of s.days) {
          for (const p of s.periods.filter((x) => !x.isBreak)) {
            allSlots.push({ day, start: p.startMinute, end: p.endMinute });
          }
        }
      }

      const teacherReport: TeacherFeasibility[] = [];
      for (const [teacherId, load] of loadByTeacher) {
        const blocked = unavailable.filter((u) => u.teacherId === teacherId);
        const available = allSlots.filter(
          (slot) =>
            !blocked.some(
              (b) =>
                b.dayOfWeek === slot.day &&
                b.startMinute < slot.end &&
                slot.start < b.endMinute,
            ),
        ).length;
        const name = teacherName.get(teacherId) ?? "Unknown teacher";
        teacherReport.push({ teacherId, name, load, available });

        if (load > available) {
          issues.push({
            level: "BLOCKER",
            code: "TEACHER_OVERLOADED",
            message: `${name}: ${load} lessons a week but only ${available} slots available${blocked.length > 0 ? " after their unavailable times" : ""} — reassign ${load - available}.`,
            teacherId,
          });
        } else if (available > 0 && load / available > 0.9) {
          issues.push({
            level: "WARNING",
            code: "TEACHER_TIGHT",
            message: `${name}: ${load} of ${available} available slots used, so their timetable will be almost completely full.`,
            teacherId,
          });
        }
      }

      teacherReport.sort((a, b) => b.load - a.load);
      return {
        ok: !issues.some((i) => i.level === "BLOCKER"),
        issues,
        classes: classReport,
        teachers: teacherReport,
      };
    });
  }

  /** Human-readable period grid, used by the wizard's review step. */
  async describeShift(schoolId: string, shiftId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const shift = await tx.schoolShift.findUnique({
        where: { id: shiftId },
        include: { periods: { orderBy: { orderIndex: "asc" } } },
      });
      if (!shift) throw new NotFoundException("Shift not found");
      return {
        ...shift,
        periods: shift.periods.map((p) => ({
          ...p,
          label: `${formatMinutes(p.startMinute)} – ${formatMinutes(p.endMinute)}`,
        })),
      };
    });
  }
}
