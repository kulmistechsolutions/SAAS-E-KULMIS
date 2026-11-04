import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  effectiveAttendanceTimes,
  schoolAttendanceTimes,
  type AssignAttendanceTimeRuleInput,
  type AttendanceTimes,
  type SaveAttendanceTimeRuleInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * A class's own attendance times — see packages/shared attendance/time-rules.
 *
 * Deleting a rule never touches a register: classes on it fall back to the
 * school's times (classes.attendanceTimeRuleId is ON DELETE SET NULL), and
 * attendance records do not point at rules at all.
 */
@Injectable()
export class AttendanceTimeRulesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The school's own times, from Settings → Attendance or the defaults. */
  async schoolTimes(schoolId: string): Promise<AttendanceTimes> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { attendanceSettings: true },
    });
    return schoolAttendanceTimes(
      school?.attendanceSettings as Partial<AttendanceTimes> | null,
    );
  }

  async list(schoolId: string) {
    const school = await this.schoolTimes(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      const rules = await tx.attendanceTimeRule.findMany({ orderBy: { name: "asc" } });
      // Only this year's classes: last year's copies still carry the link, and
      // listing them would show every class twice.
      const classes = await tx.class.findMany({
        where: { status: "ACTIVE", ...(year ? { academicYearId: year.id } : {}) },
        select: { id: true, name: true, orderIndex: true, attendanceTimeRuleId: true },
        orderBy: { orderIndex: "asc" },
      });
      return {
        school,
        rules: rules.map((r) => ({
          ...r,
          times: effectiveAttendanceTimes(school, r),
          classes: classes
            .filter((c) => c.attendanceTimeRuleId === r.id)
            .map((c) => ({ id: c.id, name: c.name })),
        })),
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          ruleId: c.attendanceTimeRuleId,
        })),
      };
    });
  }

  /** The times one class keeps, for the register screen. */
  async forClass(schoolId: string, classId: string) {
    const school = await this.schoolTimes(schoolId);
    const cls = await this.prisma.forTenant(schoolId, (tx) =>
      tx.class.findFirst({
        where: { id: classId },
        select: { id: true, attendanceTimeRule: true },
      }),
    );
    if (!cls) throw new NotFoundException("Class not found");
    const rule = cls.attendanceTimeRule;
    return {
      classId,
      rule: rule ? { id: rule.id, name: rule.name } : null,
      times: effectiveAttendanceTimes(school, rule),
      school,
    };
  }

  private data(dto: SaveAttendanceTimeRuleInput) {
    // A rule keeps only what its mode uses, so switching a FIXED rule to
    // SHIFTED cannot leave old times quietly in force.
    return dto.mode === "FIXED"
      ? {
          name: dto.name,
          mode: dto.mode,
          offsetMinutes: 0,
          startTime: dto.startTime ?? null,
          lateTime: dto.lateTime ?? null,
          endTime: dto.endTime ?? null,
          lockTime: dto.lockTime ?? null,
        }
      : {
          name: dto.name,
          mode: dto.mode,
          offsetMinutes: dto.offsetMinutes,
          startTime: null,
          lateTime: null,
          endTime: null,
          lockTime: null,
        };
  }

  create(schoolId: string, dto: SaveAttendanceTimeRuleInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const clash = await tx.attendanceTimeRule.findFirst({ where: { name: dto.name } });
      if (clash) throw new BadRequestException("A rule with this name already exists.");
      return tx.attendanceTimeRule.create({ data: { schoolId, ...this.data(dto) } });
    });
  }

  update(schoolId: string, id: string, dto: SaveAttendanceTimeRuleInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const rule = await tx.attendanceTimeRule.findFirst({ where: { id } });
      if (!rule) throw new NotFoundException("Rule not found");
      const clash = await tx.attendanceTimeRule.findFirst({
        where: { name: dto.name, id: { not: id } },
      });
      if (clash) throw new BadRequestException("A rule with this name already exists.");
      return tx.attendanceTimeRule.update({ where: { id }, data: this.data(dto) });
    });
  }

  /**
   * Make exactly these classes follow the rule.
   *
   * A class can follow one rule, so naming it here moves it off any other.
   * Classes that were on this rule and are not named go back to the
   * school's times.
   */
  assign(schoolId: string, id: string, dto: AssignAttendanceTimeRuleInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const rule = await tx.attendanceTimeRule.findFirst({ where: { id } });
      if (!rule) throw new NotFoundException("Rule not found");
      const ids = [...new Set(dto.classIds)];
      if (ids.length > 0) {
        const found = await tx.class.count({ where: { id: { in: ids } } });
        if (found !== ids.length) throw new BadRequestException("Unknown class");
      }
      const released = await tx.class.updateMany({
        where: { attendanceTimeRuleId: id, id: { notIn: ids } },
        data: { attendanceTimeRuleId: null },
      });
      const assigned =
        ids.length > 0
          ? await tx.class.updateMany({
              where: { id: { in: ids } },
              data: { attendanceTimeRuleId: id },
            })
          : { count: 0 };
      return { assigned: assigned.count, released: released.count };
    });
  }

  remove(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const rule = await tx.attendanceTimeRule.findFirst({ where: { id } });
      if (!rule) throw new NotFoundException("Rule not found");
      const classes = await tx.class.count({ where: { attendanceTimeRuleId: id } });
      await tx.attendanceTimeRule.delete({ where: { id } });
      return { success: true, classesBackOnSchoolTimes: classes };
    });
  }
}
