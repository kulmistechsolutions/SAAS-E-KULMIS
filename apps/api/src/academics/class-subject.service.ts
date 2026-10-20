import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { removeSubjectsFromExam } from "../examinations/exam-subject-removal";
import type { CreateClassSubjectInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "./prisma-errors";

@Injectable()
export class ClassSubjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Where a subject is already being used for a class: the exams that list it
   * and the marks entered under it. Shown before it is removed from the class,
   * so the school sees what removing it from the exams as well would do.
   */
  async usage(schoolId: string, classId: string, subjectId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const exams = await tx.exam.findMany({
        where: {
          classId,
          status: { not: "ARCHIVED" },
          subjects: { some: { subjectId } },
        },
        select: { id: true, name: true, status: true, section: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      const marks = exams.length
        ? await tx.examMark.groupBy({
            by: ["examId"],
            where: { examId: { in: exams.map((e) => e.id) }, subjectId, marks: { not: null } },
            _count: { _all: true },
          })
        : [];
      const byExam = new Map(marks.map((m) => [m.examId, m._count._all]));
      const list = exams.map((e) => ({
        id: e.id,
        name: e.name,
        section: e.section?.name ?? null,
        status: e.status,
        marks: byExam.get(e.id) ?? 0,
        // An exam cannot lose its only subject.
        onlySubject: false,
      }));
      return { exams: list, totalMarks: list.reduce((n, e) => n + e.marks, 0) };
    });
  }

  findAll(
    schoolId: string,
    filter?: { academicYearId?: string; classId?: string },
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.classSubject.findMany({
        where: {
          ...(filter?.academicYearId
            ? { academicYearId: filter.academicYearId }
            : {}),
          ...(filter?.classId ? { classId: filter.classId } : {}),
        },
        orderBy: { createdAt: "asc" },
      }),
    );
  }

  async create(schoolId: string, dto: CreateClassSubjectInput) {
    const [cls, subject] = await this.prisma.forTenant(schoolId, (tx) =>
      Promise.all([
        tx.class.findFirst({
          where: { id: dto.classId },
          select: { id: true, academicYearId: true },
        }),
        tx.subject.findFirst({
          where: { id: dto.subjectId },
          select: { id: true },
        }),
      ]),
    );
    if (!cls) throw new NotFoundException("Class not found");
    if (!subject) throw new NotFoundException("Subject not found");

    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.classSubject.create({
          data: {
            schoolId,
            academicYearId: dto.academicYearId || cls.academicYearId,
            classId: dto.classId,
            sectionId: dto.sectionId ?? null,
            subjectId: dto.subjectId,
          },
        }),
      )
      .catch(
        onUniqueViolation("This subject is already assigned to the class/section"),
      );
  }

  /**
   * Take a subject off a class. Exams that already list it keep it unless
   * `alsoFromExams` is set, in which case it is removed from every open exam
   * of the class too (marks included, snapshotted to the audit log) — so a
   * subject can be dropped from a class even after marks were entered for it.
   */
  async remove(
    schoolId: string,
    id: string,
    opts: { alsoFromExams?: boolean; actor?: { userId: string; username: string; role: string } } = {},
  ) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.classSubject.findFirst({
        where: { id },
        select: { id: true, classId: true, subjectId: true, subject: { select: { name: true } } },
      }),
    );
    if (!existing) throw new NotFoundException("Assignment not found");

    const fromExams = opts.alsoFromExams
      ? await this.prisma.forTenant(schoolId, async (tx) => {
          const exams = await tx.exam.findMany({
            where: {
              classId: existing.classId,
              status: { not: "ARCHIVED" },
              subjects: { some: { subjectId: existing.subjectId } },
            },
            select: { id: true, _count: { select: { subjects: true } } },
          });
          const out: { examId: string; marksRemoved: number; kept?: string }[] = [];
          for (const e of exams) {
            // An exam cannot be left with no subjects: it keeps this one.
            if (e._count.subjects <= 1) {
              out.push({ examId: e.id, marksRemoved: 0, kept: "only subject" });
              continue;
            }
            const r = await removeSubjectsFromExam(tx, e.id, [existing.subjectId]);
            out.push({ examId: e.id, marksRemoved: r.removed.reduce((n, x) => n + x.marksRemoved, 0) });
          }
          return out;
        })
      : [];

    await this.prisma.forTenant(schoolId, (tx) =>
      tx.classSubject.delete({ where: { id } }),
    );

    if (opts.alsoFromExams) {
      await this.audit.record({
        schoolId,
        userId: opts.actor?.userId ?? null,
        username: opts.actor?.username ?? null,
        role: (opts.actor?.role as never) ?? null,
        module: "academics",
        action: "CLASS_SUBJECT_REMOVED_WITH_EXAMS",
        metadata: {
          classId: existing.classId,
          subject: existing.subject.name,
          exams: fromExams,
          marksRemoved: fromExams.reduce((n, x) => n + x.marksRemoved, 0),
        },
      });
    }
    return { success: true, removedFromExams: fromExams.filter((x) => !x.kept).length, marksRemoved: fromExams.reduce((n, x) => n + x.marksRemoved, 0) };
  }
}
