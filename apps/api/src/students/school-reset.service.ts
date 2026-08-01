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

  /** Counts for a teacher reset — every teacher and what hangs off them. */
  async previewTeachers(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const school = await tx.school.findUnique({
        where: { id: schoolId },
        select: { name: true },
      });
      if (!school) throw new NotFoundException("School not found");

      const [teachers, assignments, attendance, quizzes, timetableEntries] =
        await Promise.all([
          tx.teacher.count(),
          tx.teacherAssignment.count(),
          tx.teacherAttendance.count(),
          tx.quiz.count(),
          tx.timetableEntry.count({ where: { teacherId: { not: null } } }),
        ]);

      return {
        scope: "teachers" as const,
        name: school.name,
        counts: {
          teachers,
          assignments,
          attendance,
          quizzes,
          timetableEntries,
        },
      };
    });
  }

  /**
   * Erase every teacher in the school and restart teacher numbering at 1.
   *
   * A teacher takes their class/subject assignments, attendance, quizzes and
   * unavailability with them, and their timetable slots are left unstaffed
   * rather than deleted, so the week's structure survives a re-import. Salary
   * records stay: they name the employee in their own right and are the
   * school's financial history, not the teacher's profile.
   */
  async resetTeachers(schoolId: string, confirmName: string) {
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

        const teachers = await tx.teacher.findMany({
          select: { userId: true },
        });

        // Deleting the teacher cascades assignments, attendance, quizzes and
        // unavailability; timetable entries keep their slot with no teacher.
        const deleted = await tx.teacher.deleteMany({ where: {} });
        if (teachers.length) {
          await tx.user.deleteMany({
            where: { id: { in: teachers.map((t) => t.userId) } },
          });
        }

        await resetCounter(tx, schoolId, "teacher");

        return { name: school.name, teachersDeleted: deleted.count };
      },
      { timeout: 120_000, maxWait: 30_000 },
    );

    this.logger.warn(
      `RESET TEACHERS in school ${schoolId} ("${result.name}"): ` +
        `${result.teachersDeleted} teachers erased, numbering restarted at 1`,
    );
    return { success: true, ...result };
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

  /** Counts for a full fee-data reset — every charge, payment, and activation. */
  async previewFees(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const school = await tx.school.findUnique({
        where: { id: schoolId },
        select: { name: true },
      });
      if (!school) throw new NotFoundException("School not found");
      const [charges, payments, monthlyActivations, yearlySetups, extraFees] =
        await Promise.all([
          tx.feeCharge.count(),
          tx.payment.count(),
          tx.monthlyFeeActivation.count(),
          tx.academicYearFeeSetup.count(),
          tx.extraFee.count(),
        ]);
      return {
        scope: "fees" as const,
        name: school.name,
        counts: { charges, payments, monthlyActivations, yearlySetups, extraFees },
      };
    });
  }

  /**
   * Erase every fee charge, payment, and billing activation in the school —
   * a clean financial slate. Students, classes and fee settings are kept;
   * only the money trail is wiped. Irreversible: once payments are gone,
   * their receipt numbers cannot be recovered.
   */
  async resetFees(schoolId: string, confirmName: string) {
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

        const [charges, payments] = await Promise.all([
          tx.feeCharge.deleteMany({ where: {} }),
          tx.payment.deleteMany({ where: {} }),
        ]);
        await tx.monthlyFeeActivation.deleteMany({ where: {} });
        await tx.academicYearFeeSetup.deleteMany({ where: {} });
        // Cascades ExtraFeeClassAmount.
        await tx.extraFee.deleteMany({ where: {} });

        return {
          name: school.name,
          chargesDeleted: charges.count,
          paymentsDeleted: payments.count,
        };
      },
      { timeout: 120_000, maxWait: 30_000 },
    );

    this.logger.warn(
      `RESET FEES in school ${schoolId} ("${result.name}"): ` +
        `${result.chargesDeleted} charges, ${result.paymentsDeleted} payments erased`,
    );
    return { success: true, ...result };
  }

  /**
   * Every month that has ever been activated, with enough detail to tell
   * whether it can be safely undone — a month with any payment already
   * collected against it can't be deleted without corrupting the ledger.
   */
  async listActivatedMonths(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const activations = await tx.monthlyFeeActivation.groupBy({
        by: ["year", "month"],
        _count: { _all: true },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });
      return Promise.all(
        activations.map(async (a) => {
          const charges = await tx.feeCharge.aggregate({
            where: { year: a.year, month: a.month },
            _count: { _all: true },
            _sum: { amount: true, paidAmount: true },
          });
          return {
            year: a.year,
            month: a.month,
            classesActivated: a._count._all,
            chargesCount: charges._count._all,
            totalCharged: charges._sum.amount ?? 0,
            totalPaid: charges._sum.paidAmount ?? 0,
            hasPayments: (charges._sum.paidAmount ?? 0) > 0,
          };
        }),
      );
    });
  }

  /**
   * Undo a single month's activation — deletes the MonthlyFeeActivation and
   * that month's FeeCharge rows so it can be activated again cleanly. This
   * is for the specific mistake of turning a month on too early: nothing has
   * been paid against it yet, and the next real month's carry-forward is
   * about to combine with it. Blocked once any student has paid against that
   * month — undoing after money has been collected would leave a payment on
   * record with no charge left to explain it, which is worse than the
   * mistake it's meant to fix.
   */
  async deleteMonth(
    schoolId: string,
    year: number,
    month: number,
    confirmName: string,
  ) {
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

        const paidCheck = await tx.feeCharge.aggregate({
          where: { year, month },
          _sum: { paidAmount: true },
        });
        if ((paidCheck._sum.paidAmount ?? 0) > 0) {
          throw new BadRequestException(
            "Students have already paid against this month — it can't be undone without breaking the payment record. Use Reset All Fees if you need to clear everything.",
          );
        }

        const [charges, activations] = await Promise.all([
          tx.feeCharge.deleteMany({ where: { year, month } }),
          tx.monthlyFeeActivation.deleteMany({ where: { year, month } }),
        ]);

        return {
          name: school.name,
          chargesDeleted: charges.count,
          activationsDeleted: activations.count,
        };
      },
      { timeout: 60_000, maxWait: 30_000 },
    );

    this.logger.warn(
      `DELETE MONTH ${year}-${month} in school ${schoolId} ("${result.name}"): ` +
        `${result.chargesDeleted} charges, ${result.activationsDeleted} activations erased`,
    );
    return { success: true, year, month, ...result };
  }
}
