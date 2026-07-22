import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { resetCounter } from "./code-allocator";

/**
 * Deliberate, admin-only resets — the one place numbering restarts.
 *
 * Normal deletes retire a student's ID for good (see [[code-allocator]]). When
 * a school instead wants a clean slate — a whole school starting its very
 * first intake, or one class that was set up wrong and needs re-importing —
 * this erases the students (and everything hanging off them) and, for a whole
 * school, zeroes the counters so the next student is #1 again.
 *
 * Classes, sections, teachers, subjects and settings are kept: this clears the
 * people, not the school's structure. Parents left with no children anywhere
 * are removed with their portal login; a parent with a child elsewhere stays.
 *
 * Irreversible, so every call requires an exact-name confirmation and the
 * preview shows the real counts first.
 */
@Injectable()
export class SchoolResetService {
  private readonly logger = new Logger(SchoolResetService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Counts for a whole-school reset — every student in the school. */
  async previewSchool(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [school, students] = await Promise.all([
        tx.school.findUnique({
          where: { id: schoolId },
          select: { name: true },
        }),
        tx.student.findMany({
          where: {},
          select: { id: true, parentId: true },
        }),
      ]);
      if (!school) throw new NotFoundException("School not found");
      const parentIds = [...new Set(students.map((s) => s.parentId))];
      return {
        scope: "school" as const,
        name: school.name,
        counts: {
          students: students.length,
          parents: parentIds.length,
        },
      };
    });
  }

  /** Counts for a single-class reset — that class's students only. */
  async previewClass(schoolId: string, classId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const cls = await tx.class.findFirst({
        where: { id: classId },
        select: {
          id: true,
          name: true,
          academicYear: { select: { name: true } },
        },
      });
      if (!cls) throw new NotFoundException("Class not found");
      const students = await tx.student.findMany({
        where: { classId },
        select: { id: true, parentId: true },
      });
      const parentIds = [...new Set(students.map((s) => s.parentId))];
      // A parent is only removed when this class holds every child they have.
      const parentsKeeping = parentIds.length
        ? await tx.parent.count({
            where: {
              id: { in: parentIds },
              students: { some: { classId: { not: classId } } },
            },
          })
        : 0;
      return {
        scope: "class" as const,
        name: cls.name,
        academicYear: cls.academicYear.name,
        counts: {
          students: students.length,
          parents: parentIds.length - parentsKeeping,
          parentsKept: parentsKeeping,
        },
      };
    });
  }

  /**
   * Erase every student in the school and restart numbering at 1. Keeps the
   * school's classes, teachers and settings.
   */
  async resetSchool(schoolId: string, confirmName: string) {
    const result = await this.prisma.forTenant(
      schoolId,
      async (tx) => {
        const school = await tx.school.findUnique({
          where: { id: schoolId },
          select: { name: true },
        });
        if (!school) throw new NotFoundException("School not found");
        if (confirmName.trim() !== school.name) {
          throw new BadRequestException(
            `Type the school name exactly ("${school.name}") to confirm`,
          );
        }

        const students = await tx.student.findMany({
          where: {},
          select: { parentId: true },
        });
        const parentIds = [...new Set(students.map((s) => s.parentId))];

        // Students first — every per-student table cascades off this delete.
        const deleted = await tx.student.deleteMany({ where: {} });

        // With no students left, every parent is now childless. Deleting the
        // User cascades the Parent (and its portal login).
        if (parentIds.length) {
          const orphans = await tx.parent.findMany({
            where: { id: { in: parentIds }, students: { none: {} } },
            select: { userId: true },
          });
          if (orphans.length) {
            await tx.user.deleteMany({
              where: { id: { in: orphans.map((o) => o.userId) } },
            });
          }
        }

        // Numbering starts over.
        await resetCounter(tx, schoolId, "student");
        await resetCounter(tx, schoolId, "parent");

        return { name: school.name, studentsDeleted: deleted.count };
      },
      { timeout: 120_000, maxWait: 30_000 },
    );

    this.logger.warn(
      `RESET SCHOOL "${result.name}" (${schoolId}): ${result.studentsDeleted} ` +
        `students erased, numbering restarted at 1`,
    );
    return { success: true, ...result };
  }

  /**
   * Erase every student in one class, keeping the class itself so the school
   * can re-import into it. The school counter is left alone — other classes
   * still hold higher numbers, so numbering stays monotonic across the school.
   */
  async resetClass(schoolId: string, classId: string, confirmName: string) {
    const result = await this.prisma.forTenant(
      schoolId,
      async (tx) => {
        const cls = await tx.class.findFirst({
          where: { id: classId },
          select: { id: true, name: true },
        });
        if (!cls) throw new NotFoundException("Class not found");
        if (confirmName.trim() !== cls.name) {
          throw new BadRequestException(
            `Type the class name exactly ("${cls.name}") to confirm`,
          );
        }

        const students = await tx.student.findMany({
          where: { classId },
          select: { parentId: true },
        });
        const parentIds = [...new Set(students.map((s) => s.parentId))];

        const deleted = await tx.student.deleteMany({ where: { classId } });

        if (parentIds.length) {
          const orphans = await tx.parent.findMany({
            where: { id: { in: parentIds }, students: { none: {} } },
            select: { userId: true },
          });
          if (orphans.length) {
            await tx.user.deleteMany({
              where: { id: { in: orphans.map((o) => o.userId) } },
            });
          }
        }

        return {
          name: cls.name,
          studentsDeleted: deleted.count,
        };
      },
      { timeout: 120_000, maxWait: 30_000 },
    );

    this.logger.warn(
      `RESET CLASS "${result.name}" in school ${schoolId}: ` +
        `${result.studentsDeleted} students erased (class kept)`,
    );
    return { success: true, ...result };
  }
}
