import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { SaveAttendanceShiftInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Standalone attendance shifts (e.g. "Morning", "Afternoon Session") — a
 * school's own list for tagging which session an attendance record belongs
 * to, deliberately independent of the timetable module's shift/period grid.
 */
@Injectable()
export class AttendanceShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every shift, or just the ones a school can still assign someone to.
   *
   * A retired shift stays exactly as retired-but-listed everywhere it is
   * already referenced: a teacher record, a past attendance mark, a salary
   * row. Scoping this to ACTIVE by default keeps it out of new pickers, but a
   * caller that only wants to turn an id into a name needs the retired ones
   * too — otherwise a shift retired after teachers were assigned to it makes
   * their name resolve to a raw id forever, on every screen that shows it.
   */
  list(schoolId: string, includeInactive = false) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.attendanceShift.findMany({
        where: includeInactive ? {} : { status: "ACTIVE" },
        orderBy: { orderIndex: "asc" },
      }),
    );
  }

  async create(schoolId: string, dto: SaveAttendanceShiftInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const existing = await tx.attendanceShift.findFirst({
        where: { name: dto.name },
      });
      if (existing) {
        throw new BadRequestException("A shift with this name already exists.");
      }
      const count = await tx.attendanceShift.count();
      return tx.attendanceShift.create({
        data: {
          schoolId,
          name: dto.name,
          startTime: dto.startTime ?? null,
          endTime: dto.endTime ?? null,
          orderIndex: count,
        },
      });
    });
  }

  async update(schoolId: string, id: string, dto: SaveAttendanceShiftInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const shift = await tx.attendanceShift.findFirst({ where: { id } });
      if (!shift) throw new NotFoundException("Shift not found");
      const clash = await tx.attendanceShift.findFirst({
        where: { name: dto.name, id: { not: id } },
      });
      if (clash) {
        throw new BadRequestException("A shift with this name already exists.");
      }
      return tx.attendanceShift.update({
        where: { id },
        data: {
          name: dto.name,
          startTime: dto.startTime ?? null,
          endTime: dto.endTime ?? null,
        },
      });
    });
  }

  /**
   * Everything that points at this shift, counted.
   *
   * Asked before a school is allowed to delete one for good, because "delete"
   * has to be a decision taken with the number in front of you. A shift that
   * holds two years of registers and one created by mistake this morning look
   * exactly alike in the list.
   */
  async usage(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const shift = await tx.attendanceShift.findFirst({ where: { id } });
      if (!shift) throw new NotFoundException("Shift not found");

      const [studentAttendance, teacherAttendance, teacherAssignments, teachers, officerGrants] =
        await Promise.all([
          tx.studentAttendance.count({ where: { shiftId: id } }),
          tx.teacherAttendance.count({ where: { shiftId: id } }),
          tx.teacherAssignment.count({ where: { shiftId: id } }),
          tx.teacherShift.count({ where: { shiftId: id } }),
          tx.attendanceAssignment.count({ where: { shiftId: id } }),
        ]);

      // The span the registers cover, so a school can recognise what it is
      // about to unpick without opening the attendance screen.
      const range =
        studentAttendance > 0
          ? await tx.studentAttendance.aggregate({
              where: { shiftId: id },
              _min: { date: true },
              _max: { date: true },
            })
          : null;

      return {
        id,
        name: shift.name,
        status: shift.status,
        studentAttendance,
        teacherAttendance,
        teacherAssignments,
        teachers,
        officerGrants,
        firstDate: range?._min.date
          ? range._min.date.toISOString().slice(0, 10)
          : null,
        lastDate: range?._max.date
          ? range._max.date.toISOString().slice(0, 10)
          : null,
      };
    });
  }

  /**
   * Retire a shift, or delete it outright.
   *
   * Retiring is the default and stays the safe one: the shift keeps its name,
   * every record that points at it still resolves, and it stops being offered
   * for new work. But a retired shift is not gone, and a school that created
   * "Morning" twice by mistake was told "Removed" and then watched it sit
   * there for ever, which is the system saying one thing and doing another.
   *
   * A hard delete keeps the attendance. Every register's `shiftId` is declared
   * `onDelete: SetNull`, so the marks themselves survive with the shift simply
   * unset — and the marking screen already falls back to the unshifted
   * register for exactly that case, so the days stay readable. What does go is
   * the statements ABOUT the shift: which teachers worked it, which officers
   * were granted it. Those describe a session that no longer exists.
   */
  async remove(schoolId: string, id: string, opts: { hard?: boolean } = {}) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const shift = await tx.attendanceShift.findFirst({ where: { id } });
      if (!shift) throw new NotFoundException("Shift not found");

      if (!opts.hard) {
        await tx.attendanceShift.update({
          where: { id },
          data: { status: "INACTIVE" },
        });
        return { success: true, deleted: false };
      }

      const kept = await tx.studentAttendance.count({ where: { shiftId: id } });
      await tx.attendanceShift.delete({ where: { id } });
      return { success: true, deleted: true, attendanceKept: kept };
    });
  }
}
