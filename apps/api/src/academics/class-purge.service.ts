import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Permanently erasing a class (§ "reset a mis-set-up grade").
 *
 * Two grades imported into the wrong classes cannot be untangled row by row —
 * the school needs the whole thing gone so it can import again cleanly. That
 * means the class, every student in it, and everything hanging off those
 * students: attendance, fee charges, payments, exam marks, quiz attempts,
 * book loans, promotion records, portal blocks. Parents go too, but only the
 * ones left with no children anywhere — a parent with a child in another
 * class keeps their account.
 *
 * This is irreversible, so nothing here runs without an exact-name
 * confirmation from the caller, and the preview below is what the UI shows
 * before asking for it.
 */
@Injectable()
export class ClassPurgeService {
  private readonly logger = new Logger(ClassPurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Everything that would be destroyed, counted, without touching anything. */
  async preview(schoolId: string, classId: string) {
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
      const studentIds = students.map((s) => s.id);
      const parentIds = [...new Set(students.map((s) => s.parentId))];

      const [
        sections,
        exams,
        examMarks,
        attendance,
        feeCharges,
        payments,
        quizAttempts,
        bookLoans,
        promotions,
        assignments,
        timetableEntries,
        libraryDocuments,
      ] = await Promise.all([
        tx.section.count({ where: { classId } }),
        tx.exam.count({ where: { classId } }),
        tx.examMark.count({ where: { studentId: { in: studentIds } } }),
        tx.studentAttendance.count({
          where: { studentId: { in: studentIds } },
        }),
        tx.feeCharge.count({ where: { studentId: { in: studentIds } } }),
        tx.payment.count({ where: { studentId: { in: studentIds } } }),
        tx.quizAttempt.count({ where: { studentId: { in: studentIds } } }),
        tx.bookLoan.count({ where: { studentId: { in: studentIds } } }),
        tx.promotionRecord.count({ where: { studentId: { in: studentIds } } }),
        tx.teacherAssignment.count({ where: { classId } }),
        tx.timetableEntry.count({ where: { classId } }),
        tx.libraryDocument.count({ where: { classId } }),
      ]);

      // A parent is only removed when this class holds every child they have.
      const parentsKeeping = await tx.parent.count({
        where: {
          id: { in: parentIds },
          students: { some: { classId: { not: classId } } },
        },
      });

      return {
        classId: cls.id,
        className: cls.name,
        academicYear: cls.academicYear.name,
        counts: {
          students: students.length,
          parentsDeleted: parentIds.length - parentsKeeping,
          parentsKept: parentsKeeping,
          sections,
          exams,
          examMarks,
          attendance,
          feeCharges,
          payments,
          quizAttempts,
          bookLoans,
          promotions,
          teacherAssignments: assignments,
          timetableEntries,
          libraryDocuments,
        },
      };
    });
  }

  /**
   * Erase the class. `confirmName` must equal the class name exactly — the
   * UI makes the admin type it, so a mis-click can never reach this.
   */
  async purge(schoolId: string, classId: string, confirmName: string) {
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
            `Type the class name exactly ("${cls.name}") to confirm deletion`,
          );
        }

        const students = await tx.student.findMany({
          where: { classId },
          select: { id: true, code: true, parentId: true },
        });
        const parentIds = [...new Set(students.map((s) => s.parentId))];
        const freedCodes = students.map((s) => s.code);

        // Students first: every per-student table cascades off this one delete.
        const deletedStudents = await tx.student.deleteMany({
          where: { classId },
        });

        // Now that the students are gone, childless parents fall out. Deleting
        // the User cascades the Parent, so the portal login goes with it.
        const orphanParents = parentIds.length
          ? await tx.parent.findMany({
              where: { id: { in: parentIds }, students: { none: {} } },
              select: { userId: true, code: true },
            })
          : [];
        if (orphanParents.length) {
          await tx.user.deleteMany({
            where: { id: { in: orphanParents.map((p) => p.userId) } },
          });
        }

        // Class-scoped library documents block the class delete (Restrict).
        await tx.libraryDocument.deleteMany({ where: { classId } });

        // Sections, exams, quizzes, assignments, timetable entries, subject
        // loads and fee amounts all cascade from the class itself.
        await tx.class.delete({ where: { id: classId } });

        return {
          className: cls.name,
          studentsDeleted: deletedStudents.count,
          parentsDeleted: orphanParents.length,
          freedStudentCodes: freedCodes,
          freedParentCodes: orphanParents.map((p) => p.code),
        };
      },
      // Bulk cascades over a full grade take longer than a normal request.
      { timeout: 120_000, maxWait: 30_000 },
    );

    this.logger.warn(
      `Purged class "${result.className}" in school ${schoolId}: ` +
        `${result.studentsDeleted} students, ${result.parentsDeleted} parents. ` +
        `Freed student IDs: ${result.freedStudentCodes.join(", ") || "none"}`,
    );

    return { success: true, ...result };
  }
}
