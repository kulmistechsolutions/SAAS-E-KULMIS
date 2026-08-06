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

  list(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.attendanceShift.findMany({
        where: { status: "ACTIVE" },
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

  /** Soft-delete — past attendance rows keep pointing at the shift's name/history. */
  async remove(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const shift = await tx.attendanceShift.findFirst({ where: { id } });
      if (!shift) throw new NotFoundException("Shift not found");
      await tx.attendanceShift.update({
        where: { id },
        data: { status: "INACTIVE" },
      });
      return { success: true };
    });
  }
}
