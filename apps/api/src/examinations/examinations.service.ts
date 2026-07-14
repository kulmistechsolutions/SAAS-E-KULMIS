import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import ExcelJS from "exceljs";
import type {
  BlockStudentInput,
  CreateExamGroupInput,
  CreateExamInput,
  ExamCreationBulkInput,
  UpsertExamMarksInput,
  UserRole,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentsService } from "../documents/documents.service";
import { TeachersService } from "../teachers/teachers.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditService } from "../audit/audit.service";
import { SmsService } from "../sms/sms.service";
import { StorageService } from "../storage/storage.service";
import type { AuthUser } from "../auth/auth.types";

export interface MonitoringDetailRow {
  examId: string;
  examName: string;
  classId: string;
  className: string;
  sectionId: string | null;
  section: string | null;
  subjectId: string;
  subject: string;
  examSubjectId: string;
  teacherId: string | null;
  teacherName: string | null;
  teacherUserId: string | null;
  status: string;
  submittedAt: Date | null;
}

export interface MarksImportSummary {
  total: number;
  imported: number;
  updated: number;
  failed: number;
  errors: { row: number; studentId?: string; message: string }[];
}

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function gradeFromAverage(avg: number): string {
  if (avg >= 90) return "A+";
  if (avg >= 80) return "A";
  if (avg >= 70) return "B";
  if (avg >= 60) return "C";
  if (avg >= 50) return "D";
  return "F";
}

function teacherMarksBlocked(examStatus: string, role?: string): boolean {
  if (role !== "TEACHER") return false;
  return examStatus === "LOCKED" || examStatus === "PUBLISHED";
}

@Injectable()
export class ExaminationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docs: DocumentsService,
    private readonly teachers: TeachersService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly sms: SmsService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  listGroups(schoolId: string, academicYearId?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.examGroup.findMany({
        where: academicYearId ? { academicYearId } : undefined,
        orderBy: { name: "asc" },
        include: { academicYear: { select: { name: true } } },
      }),
    );
  }

  createGroup(schoolId: string, dto: CreateExamGroupInput) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.examGroup.create({
        data: {
          schoolId,
          academicYearId: dto.academicYearId,
          name: dto.name,
          description: dto.description ?? null,
        },
      }),
    );
  }

  /** Resolve teacher profile for the logged-in user (used by exam scoping). */
  resolveTeacherForUser(schoolId: string, userId: string) {
    return this.teachers.findByUserId(schoolId, userId);
  }

  listExams(
    schoolId: string,
    filters?: {
      academicYearId?: string;
      classId?: string;
      classIds?: string[];
    },
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.exam.findMany({
        where: {
          ...(filters?.academicYearId
            ? { academicYearId: filters.academicYearId }
            : {}),
          ...(filters?.classId ? { classId: filters.classId } : {}),
          ...(filters?.classIds?.length
            ? { classId: { in: filters.classIds } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
          academicYear: { select: { name: true } },
          examGroup: { select: { name: true } },
          subjects: { include: { subject: { select: { name: true } } } },
        },
      }),
    );
  }

  async getExam(schoolId: string, examId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const exam = await tx.exam.findFirst({
        where: { id: examId },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
          academicYear: { select: { name: true } },
          examGroup: { select: { name: true } },
          subjects: {
            include: {
              subject: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (!exam) throw new NotFoundException("Exam not found");
      return exam;
    });
  }

  async createExam(
    schoolId: string,
    dto: CreateExamInput,
    userId?: string,
    role?: string,
  ) {
    if (role === "TEACHER") {
      throw new ForbiddenException(
        "Teachers cannot create official school examinations",
      );
    }

    return this.prisma.forTenant(schoolId, async (tx) => {
      // Resolve the responsible teacher for every subject in ONE query, then
      // map in memory — a per-subject query loop here would run N round-trips
      // inside the transaction and time out on a slow remote pooler.
      const assignments = await tx.teacherAssignment.findMany({
        where: {
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          subjectId: { in: dto.subjectIds },
          OR: [{ sectionId: dto.sectionId ?? null }, { sectionId: null }],
        },
        select: { subjectId: true, sectionId: true, teacherId: true },
      });
      // Prefer an exact section match over an "all sections" (null) assignment.
      const bySubject = new Map<string, { sectionId: string | null; teacherId: string }>();
      for (const a of assignments) {
        const cur = bySubject.get(a.subjectId);
        if (!cur || (cur.sectionId === null && a.sectionId !== null)) {
          bySubject.set(a.subjectId, { sectionId: a.sectionId, teacherId: a.teacherId });
        }
      }
      const subjectRows = [];
      for (const subjectId of dto.subjectIds) {
        subjectRows.push({
          schoolId,
          subjectId,
          teacherId: bySubject.get(subjectId)?.teacherId ?? null,
        });
      }

      const exam = await tx.exam.create({
        data: {
          schoolId,
          academicYearId: dto.academicYearId,
          examGroupId: dto.examGroupId ?? null,
          name: dto.name,
          examType: dto.examType,
          term: dto.term,
          maxMarks: dto.maxMarks,
          weightPercent: dto.weightPercent,
          startDate: parseDate(dto.startDate),
          endDate: parseDate(dto.endDate),
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          createdByUserId: userId ?? null,
          subjects: { create: subjectRows },
        },
        include: {
          subjects: { include: { subject: { select: { name: true } } } },
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      });
      return exam;
    });
  }

  async updateExamStatus(schoolId: string, examId: string, status: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const exam = await tx.exam.findFirst({ where: { id: examId } });
      if (!exam) throw new NotFoundException("Exam not found");
      if (status === "PUBLISHED" && exam.status !== "LOCKED") {
        throw new BadRequestException(
          "Only locked examinations may be published",
        );
      }
      const updated = await tx.exam.update({
        where: { id: examId },
        data: {
          status: status as never,
          publishedAt: status === "PUBLISHED" ? new Date() : exam.publishedAt,
        },
      });
      if (status === "LOCKED" || status === "PUBLISHED") {
        await tx.examSubject.updateMany({
          where: { examId },
          data: { submissionStatus: "LOCKED" },
        });
      }
      return updated;
    });
  }

  /** Toggle teacher lock — prevents teachers from editing marks. */
  async setTeacherLock(
    schoolId: string,
    examId: string,
    locked: boolean,
    actor?: Pick<AuthUser, "userId" | "username" | "role">,
  ) {
    if (locked) {
      const exam = await this.prisma.forTenant(schoolId, (tx) =>
        tx.exam.findFirst({ where: { id: examId }, select: { status: true } }),
      );
      if (!exam) throw new NotFoundException("Exam not found");
      if (exam.status === "PUBLISHED") {
        throw new BadRequestException(
          "Unpublish results before changing teacher lock on a published exam.",
        );
      }
      const result = await this.updateExamStatus(schoolId, examId, "LOCKED");
      await this.recordExamAudit(schoolId, actor, "EXAM_TEACHER_LOCKED", examId);
      return result;
    }
    const exam = await this.prisma.forTenant(schoolId, (tx) =>
      tx.exam.findFirst({ where: { id: examId }, select: { status: true } }),
    );
    if (!exam) throw new NotFoundException("Exam not found");
    if (exam.status === "PUBLISHED") {
      throw new BadRequestException("Unpublish before unlocking teachers.");
    }
    const result = await this.updateExamStatus(schoolId, examId, "OPEN");
    await this.recordExamAudit(schoolId, actor, "EXAM_TEACHER_UNLOCKED", examId);
    return result;
  }

  /** Toggle student/parent portal visibility (separate from teacher lock). */
  async setStudentPortalPublish(
    schoolId: string,
    examId: string,
    published: boolean,
    actor?: Pick<AuthUser, "userId" | "username" | "role">,
  ) {
    if (published) {
      const exam = await this.prisma.forTenant(schoolId, (tx) =>
        tx.exam.findFirst({ where: { id: examId }, select: { status: true } }),
      );
      if (!exam) throw new NotFoundException("Exam not found");
      if (exam.status !== "LOCKED" && exam.status !== "PUBLISHED") {
        throw new BadRequestException(
          "Enable teacher lock before publishing results to the student portal.",
        );
      }
      const result = await this.updateExamStatus(schoolId, examId, "PUBLISHED");
      await this.recordExamAudit(schoolId, actor, "EXAM_RESULTS_PUBLISHED", examId);
      return result;
    }
    const exam = await this.prisma.forTenant(schoolId, (tx) =>
      tx.exam.findFirst({ where: { id: examId }, select: { status: true } }),
    );
    if (!exam) throw new NotFoundException("Exam not found");
    if (exam.status !== "PUBLISHED") {
      return exam;
    }
    const result = await this.updateExamStatus(schoolId, examId, "LOCKED");
    await this.recordExamAudit(schoolId, actor, "EXAM_RESULTS_UNPUBLISHED", examId);
    return result;
  }

  async upsertMarks(
    schoolId: string,
    dto: UpsertExamMarksInput,
    userId?: string,
    role?: string,
  ) {
    // Read the exam and run authorization OUTSIDE the write transaction:
    // assertOwnsAssignment opens its own tenant transaction, so calling it
    // inside forTenant would nest transactions and deadlock/expire on a pooler.
    const exam = await this.prisma.forTenant(schoolId, (tx) =>
      tx.exam.findFirst({
        where: { id: dto.examId },
        select: {
          id: true,
          maxMarks: true,
          status: true,
          classId: true,
          sectionId: true,
          academicYearId: true,
        },
      }),
    );
    if (!exam) throw new NotFoundException("Exam not found");
    if (teacherMarksBlocked(exam.status, role)) {
      throw new BadRequestException("Exam is locked");
    }
    if (role === "TEACHER" && userId) {
      const subjectIds = [...new Set(dto.records.map((r) => r.subjectId))];
      for (const subjectId of subjectIds) {
        await this.teachers.assertOwnsAssignment(schoolId, userId, {
          classId: exam.classId,
          sectionId: exam.sectionId,
          subjectId,
          academicYearId: exam.academicYearId,
        });
      }
    }
    for (const rec of dto.records) {
      if (rec.marks !== null && rec.marks > exam.maxMarks) {
        throw new BadRequestException(`Marks cannot exceed ${exam.maxMarks}`);
      }
    }

    return this.prisma.forTenant(schoolId, async (tx) => {
      let saved = 0;
      for (const rec of dto.records) {
        await tx.examMark.upsert({
          where: {
            schoolId_examId_studentId_subjectId: {
              schoolId,
              examId: dto.examId,
              studentId: rec.studentId,
              subjectId: rec.subjectId,
            },
          },
          create: {
            schoolId,
            examId: dto.examId,
            studentId: rec.studentId,
            subjectId: rec.subjectId,
            marks: rec.marks,
            enteredByUserId: userId ?? null,
            enteredAt: new Date(),
          },
          update: {
            marks: rec.marks,
            enteredByUserId: userId ?? null,
            enteredAt: new Date(),
          },
        });
        saved++;
      }

      await this.refreshSubmissionStatuses(tx, schoolId, dto.examId);
      if (
        role &&
        role !== "TEACHER" &&
        (exam.status === "LOCKED" || exam.status === "PUBLISHED")
      ) {
        await this.recordExamAudit(
          schoolId,
          userId ? { userId, username: userId, role: role as UserRole } : undefined,
          "EXAM_MARKS_CORRECTED",
          dto.examId,
          { records: dto.records.length },
        );
      }
      return { saved };
    }, { timeout: 60_000, maxWait: 30_000 });
  }

  /** Teacher explicitly submits marks for one subject (locks further edits until admin unlocks). */
  async submitSubject(
    schoolId: string,
    examId: string,
    subjectId: string,
    userId: string,
    role: string,
  ) {
    if (role === "TEACHER") {
      const exam = await this.prisma.forTenant(schoolId, (tx) =>
        tx.exam.findFirst({
          where: { id: examId },
          select: {
            classId: true,
            sectionId: true,
            academicYearId: true,
            status: true,
          },
        }),
      );
      if (!exam) throw new NotFoundException("Exam not found");
      if (teacherMarksBlocked(exam.status, role)) {
        throw new BadRequestException("Exam is locked");
      }
      await this.teachers.assertOwnsAssignment(schoolId, userId, {
        classId: exam.classId,
        sectionId: exam.sectionId,
        subjectId,
        academicYearId: exam.academicYearId,
      });
    }

    return this.prisma.forTenant(schoolId, async (tx) => {
      const es = await tx.examSubject.findFirst({
        where: { examId, subjectId },
      });
      if (!es) throw new NotFoundException("Exam subject not found");
      if (es.submissionStatus === "LOCKED") {
        throw new BadRequestException("Submission is locked");
      }
      return tx.examSubject.update({
        where: { id: es.id },
        data: {
          submissionStatus: "SUBMITTED",
          submittedAt: new Date(),
        },
      });
    });
  }

  private async refreshSubmissionStatuses(
    tx: Parameters<Parameters<PrismaService["forTenant"]>[1]>[0],
    schoolId: string,
    examId: string,
  ) {
    const exam = await tx.exam.findFirst({
      where: { id: examId },
      select: { classId: true, sectionId: true },
    });
    if (!exam) return;

    const studentCount = await tx.student.count({
      where: {
        classId: exam.classId,
        sectionId: exam.sectionId,
        status: "ACTIVE",
      },
    });
    if (!studentCount) return;

    const examSubjects = await tx.examSubject.findMany({
      where: { examId },
      select: { id: true, subjectId: true },
    });

    // Count entered marks for all subjects in ONE groupBy, then apply status in
    // at most two updateMany calls — a per-subject count+update loop here runs
    // 2×N round-trips inside the transaction and times out on a slow pooler.
    const counts = await tx.examMark.groupBy({
      by: ["subjectId"],
      where: { examId, marks: { not: null } },
      _count: { _all: true },
    });
    const countBySubject = new Map(
      counts.map((c) => [c.subjectId, c._count._all]),
    );
    const submittedIds: string[] = [];
    const pendingIds: string[] = [];
    for (const es of examSubjects) {
      const marksCount = countBySubject.get(es.subjectId) ?? 0;
      if (marksCount >= studentCount) submittedIds.push(es.id);
      else pendingIds.push(es.id);
    }
    if (submittedIds.length) {
      await tx.examSubject.updateMany({
        where: { id: { in: submittedIds } },
        data: { submissionStatus: "SUBMITTED" as never, submittedAt: new Date() },
      });
    }
    if (pendingIds.length) {
      await tx.examSubject.updateMany({
        where: { id: { in: pendingIds } },
        data: { submissionStatus: "PENDING" as never, submittedAt: null },
      });
    }
  }

  getMarks(schoolId: string, examId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.examMark.findMany({
        where: { examId },
        include: {
          student: { select: { id: true, code: true, fullName: true } },
          subject: { select: { id: true, name: true } },
        },
      }),
    );
  }

  /** Active students for an exam's class/section (mark entry roster). */
  async examRoster(
    schoolId: string,
    examId: string,
    userId?: string,
    role?: string,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const exam = await tx.exam.findFirst({
        where: { id: examId },
        select: {
          id: true,
          classId: true,
          sectionId: true,
          academicYearId: true,
        },
      });
      if (!exam) throw new NotFoundException("Exam not found");

      if (role === "TEACHER" && userId) {
        const teacher = await this.teachers.findByUserId(schoolId, userId);
        const allowed = teacher.assignments.some(
          (a) =>
            a.academicYearId === exam.academicYearId &&
            a.classId === exam.classId &&
            (a.sectionId === null || a.sectionId === exam.sectionId),
        );
        if (!allowed) {
          throw new BadRequestException(
            "You are not assigned to this exam's class and section",
          );
        }
      }

      return this.examStudents(tx, exam);
    });
  }

  /**
   * Load an exam for a marks operation and enforce that the subject belongs to
   * it and (for teachers) that the caller is assigned to teach it.
   */
  private async loadExamSubjectForMarks(
    tx: Parameters<Parameters<PrismaService["forTenant"]>[1]>[0],
    schoolId: string,
    examId: string,
    subjectId: string,
    userId: string | undefined,
    role: string | undefined,
  ) {
    const exam = await tx.exam.findFirst({
      where: { id: examId },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        subjects: { include: { subject: { select: { id: true, name: true } } } },
      },
    });
    if (!exam) throw new NotFoundException("Exam not found");
    const examSubject = exam.subjects.find((s) => s.subject.id === subjectId);
    if (!examSubject) {
      throw new BadRequestException("This subject is not part of this exam");
    }
    if (role === "TEACHER" && userId) {
      // Throws ForbiddenException if the teacher isn't assigned this subject
      // for the exam's class/section — prevents marks for unassigned subjects.
      await this.teachers.assertOwnsAssignment(schoolId, userId, {
        classId: exam.classId,
        sectionId: exam.sectionId,
        subjectId,
        academicYearId: exam.academicYearId,
      });
    }
    return { exam, examSubject };
  }

  /** Active students in the exam's class + section, sorted A→Z. */
  private examStudents(
    tx: Parameters<Parameters<PrismaService["forTenant"]>[1]>[0],
    exam: { classId: string; sectionId: string | null },
  ) {
    return tx.student.findMany({
      where: {
        classId: exam.classId,
        sectionId: exam.sectionId,
        status: "ACTIVE",
      },
      select: { id: true, code: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
  }

  /**
   * Build an .xlsx mark-entry template for one exam + subject. Only students of
   * the exam's class/section appear (A→Z); the header starts at cell A1.
   */
  async marksTemplate(
    schoolId: string,
    examId: string,
    subjectId: string,
    userId?: string,
    role?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const { exam } = await this.loadExamSubjectForMarks(
        tx,
        schoolId,
        examId,
        subjectId,
        userId,
        role,
      );
      const subjectName =
        exam.subjects.find((s) => s.subject.id === subjectId)?.subject.name ??
        "Subject";
      const students = await this.examStudents(tx, exam);
      const existing = await tx.examMark.findMany({
        where: { examId, subjectId },
        select: { studentId: true, marks: true },
      });
      const marksByStudent = new Map(existing.map((m) => [m.studentId, m.marks]));

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Marks");
      ws.columns = [
        { header: "Student ID", key: "code", width: 16 },
        { header: "Student Name", key: "name", width: 30 },
        { header: "Class", key: "class", width: 14 },
        { header: "Section", key: "section", width: 12 },
        { header: "Subject", key: "subject", width: 18 },
        { header: `Marks (max ${exam.maxMarks})`, key: "marks", width: 16 },
      ];
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).eachCell((c) => {
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEFEFEF" },
        };
      });
      for (const s of students) {
        ws.addRow({
          code: s.code,
          name: s.fullName,
          class: exam.class.name,
          section: exam.section?.name ?? "All",
          subject: subjectName,
          marks: marksByStudent.get(s.id) ?? null,
        });
      }
      // Lock the identity columns so graders only fill the Marks column.
      ws.eachRow((row, n) => {
        if (n === 1) return;
        for (let c = 1; c <= 5; c++) row.getCell(c).protection = { locked: true };
      });

      const arrayBuffer = await wb.xlsx.writeBuffer();
      const safe = `${exam.class.name}-${exam.section?.name ?? "All"}-${subjectName}`
        .replace(/[^a-z0-9]+/gi, "_");
      return {
        buffer: Buffer.from(arrayBuffer),
        filename: `marks-template-${safe}.xlsx`,
      };
    });
  }

  /**
   * Import a completed marks template. Reuses every validation rule (locked
   * exam, subject ownership, max marks, class/section membership) and returns a
   * per-row summary instead of failing the whole batch on the first bad row.
   */
  async importMarks(
    schoolId: string,
    examId: string,
    subjectId: string,
    buffer: Buffer,
    userId?: string,
    role?: string,
  ): Promise<MarksImportSummary> {
    // Parse the workbook outside the DB transaction (CPU-only work).
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException("The uploaded file has no sheet");

    // Locate the "Student ID" and "Marks" columns from the header row so
    // manually reordered templates still import correctly.
    const header = ws.getRow(1);
    let idCol = 0;
    let marksCol = 0;
    header.eachCell((cell, col) => {
      const v = String(cell.value ?? "").trim().toLowerCase();
      if (v === "student id" || v === "id") idCol = col;
      if (v.startsWith("marks")) marksCol = col;
    });
    if (!idCol || !marksCol) {
      throw new BadRequestException(
        'Template is missing a "Student ID" or "Marks" column',
      );
    }

    const parsed: { row: number; code: string; raw: unknown }[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const code = String(row.getCell(idCol).value ?? "").trim();
      if (!code) return; // blank line
      parsed.push({ row: rowNumber, code, raw: row.getCell(marksCol).value });
    });

    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
        const { exam } = await this.loadExamSubjectForMarks(
          tx,
          schoolId,
          examId,
          subjectId,
          userId,
          role,
        );
        if (teacherMarksBlocked(exam.status, role)) {
          throw new BadRequestException("Exam is locked");
        }

        const students = await this.examStudents(tx, exam);
        const byCode = new Map(
          students.map((s) => [s.code.trim().toUpperCase(), s]),
        );
        const alreadyMarked = new Set(
          (
            await tx.examMark.findMany({
              where: { examId, subjectId, marks: { not: null } },
              select: { studentId: true },
            })
          ).map((m) => m.studentId),
        );

        const summary: MarksImportSummary = {
          total: parsed.length,
          imported: 0,
          updated: 0,
          failed: 0,
          errors: [],
        };

        for (const p of parsed) {
          const student = byCode.get(p.code.toUpperCase());
          if (!student) {
            summary.failed++;
            summary.errors.push({
              row: p.row,
              studentId: p.code,
              message: "Not a student of this class/section",
            });
            continue;
          }
          // Resolve the numeric mark value (Excel cells can be number/formula).
          let value: unknown = p.raw;
          if (value && typeof value === "object" && "result" in value) {
            value = (value as { result: unknown }).result;
          }
          if (value === null || value === undefined || value === "") {
            continue; // no mark supplied — leave unchanged
          }
          const marks = Number(value);
          if (Number.isNaN(marks) || marks < 0) {
            summary.failed++;
            summary.errors.push({
              row: p.row,
              studentId: p.code,
              message: `Invalid marks "${String(value)}"`,
            });
            continue;
          }
          if (marks > exam.maxMarks) {
            summary.failed++;
            summary.errors.push({
              row: p.row,
              studentId: p.code,
              message: `Marks ${marks} exceed the maximum of ${exam.maxMarks}`,
            });
            continue;
          }
          await tx.examMark.upsert({
            where: {
              schoolId_examId_studentId_subjectId: {
                schoolId,
                examId,
                studentId: student.id,
                subjectId,
              },
            },
            create: {
              schoolId,
              examId,
              studentId: student.id,
              subjectId,
              marks,
              enteredByUserId: userId ?? null,
              enteredAt: new Date(),
            },
            update: {
              marks,
              enteredByUserId: userId ?? null,
              enteredAt: new Date(),
            },
          });
          if (alreadyMarked.has(student.id)) summary.updated++;
          else summary.imported++;
        }

        await this.refreshSubmissionStatuses(tx, schoolId, examId);
        return summary;
      },
      { timeout: 60_000, maxWait: 60_000 },
    );
  }

  monitoring(schoolId: string, examId?: string) {
    return this.buildMonitoringRows(schoolId, { examId }).then((rows) =>
      rows.map((r) => ({
        examId: r.examId,
        examName: r.examName,
        className: r.className,
        section: r.section,
        subject: r.subject,
        teacherName: r.teacherName,
        status: r.status,
      })),
    );
  }

  /** Class-level monitoring overview — one row per class. */
  async monitoringClassesOverview(
    schoolId: string,
    academicYearId?: string,
    examId?: string,
  ) {
    const rows = await this.buildMonitoringRows(schoolId, {
      examId,
      academicYearId,
    });
    const byClass = new Map<
      string,
      {
        classId: string;
        className: string;
        sections: Set<string>;
        subjects: Set<string>;
        submitted: number;
        pending: number;
      }
    >();

    for (const row of rows) {
      let entry = byClass.get(row.classId);
      if (!entry) {
        entry = {
          classId: row.classId,
          className: row.className,
          sections: new Set(),
          subjects: new Set(),
          submitted: 0,
          pending: 0,
        };
        byClass.set(row.classId, entry);
      }
      if (row.sectionId) entry.sections.add(row.sectionId);
      entry.subjects.add(row.subjectId);
      if (row.status === "SUBMITTED" || row.status === "LOCKED") {
        entry.submitted += 1;
      } else {
        entry.pending += 1;
      }
    }

    const result = [];
    for (const entry of byClass.values()) {
      const [studentCount, sectionCount] = await Promise.all([
        this.prisma.forTenant(schoolId, (tx) =>
          tx.student.count({
            where: { classId: entry.classId, status: "ACTIVE" },
          }),
        ),
        this.prisma.forTenant(schoolId, (tx) =>
          tx.section.count({ where: { classId: entry.classId } }),
        ),
      ]);
      const totalSubjects = entry.subjects.size;
      const submitted = entry.submitted;
      const pending = entry.pending;
      result.push({
        classId: entry.classId,
        className: entry.className,
        sectionCount: sectionCount || entry.sections.size || 1,
        studentCount,
        subjectCount: totalSubjects,
        submitted,
        pending,
        status:
          totalSubjects > 0 && pending === 0 ? "Complete" : "In Progress",
      });
    }

    return result.sort((a, b) => a.className.localeCompare(b.className));
  }

  /** Subject-level monitoring for one class with optional section filter. */
  async monitoringClassDetail(
    schoolId: string,
    classId: string,
    opts: { academicYearId?: string; examId?: string; sectionId?: string },
  ) {
    const rows = await this.buildMonitoringRows(schoolId, {
      examId: opts.examId,
      academicYearId: opts.academicYearId,
      classId,
      sectionId: opts.sectionId,
    });

    const sections = await this.prisma.forTenant(schoolId, (tx) =>
      tx.section.findMany({
        where: { classId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    );

    const submitted = rows.filter(
      (r) => r.status === "SUBMITTED" || r.status === "LOCKED",
    ).length;
    const pending = rows.filter((r) => r.status === "PENDING").length;
    const total = rows.length;

    return {
      summary: {
        totalSubjects: total,
        submittedSubjects: submitted,
        pendingSubjects: pending,
        completionPercent: total ? Math.round((submitted / total) * 100) : 0,
      },
      sections,
      subjects: rows.map((r) => ({
        examId: r.examId,
        examName: r.examName,
        examSubjectId: r.examSubjectId,
        subjectId: r.subjectId,
        subject: r.subject,
        teacherId: r.teacherId,
        teacherName: r.teacherName ?? "Unassigned",
        className: r.className,
        section: r.section ?? "All",
        sectionId: r.sectionId,
        submissionStatus: r.status,
        submittedAt: r.submittedAt,
      })),
    };
  }

  /** Notify assigned teacher about a pending submission. */
  async sendSubmissionReminder(
    schoolId: string,
    examId: string,
    subjectId: string,
    opts: { sms?: boolean; email?: boolean },
    actor?: Pick<AuthUser, "userId" | "username" | "role">,
  ) {
    const row = (
      await this.buildMonitoringRows(schoolId, { examId, subjectId })
    )[0];
    if (!row) throw new NotFoundException("Exam subject not found");
    if (row.status !== "PENDING") {
      throw new BadRequestException("Only pending submissions can be reminded.");
    }
    if (!row.teacherUserId) {
      throw new BadRequestException("No teacher assigned to this subject.");
    }

    const title = "Exam marks submission reminder";
    const body = `Please submit marks for ${row.subject} — ${row.examName} (${row.className}${row.section ? ` · ${row.section}` : ""}).`;

    await this.notifications.create(schoolId, {
      title,
      body,
      type: "EXAM_REMINDER",
      userId: row.teacherUserId,
    });

    let smsSent = false;
    if (opts.sms && row.teacherId) {
      const teacher = await this.prisma.forTenant(schoolId, (tx) =>
        tx.teacher.findFirst({
          where: { id: row.teacherId! },
          select: { phone: true, fullName: true },
        }),
      );
      if (teacher?.phone) {
        try {
          const school = await this.prisma.school.findFirst({
            where: { id: schoolId },
            select: { name: true },
          });
          await this.sms.sendDirect(schoolId, actor?.userId, {
            category: "EXAM_ANNOUNCEMENT",
            body: `${school?.name ?? "School"}: Please submit ${row.subject} marks for ${row.examName} (${row.className}).`,
            recipients: [
              {
                phone: teacher.phone,
                name: teacher.fullName,
                type: "TEACHER",
                refId: row.teacherId!,
              },
            ],
          });
          smsSent = true;
        } catch {
          /* SMS optional — in-app reminder still delivered */
        }
      }
    }

    let emailSent = false;
    if (opts.email && row.teacherId) {
      const teacher = await this.prisma.forTenant(schoolId, (tx) =>
        tx.teacher.findFirst({
          where: { id: row.teacherId! },
          select: { email: true },
        }),
      );
      if (teacher?.email) {
        await this.notifications.create(schoolId, {
          title: `[Email] ${title}`,
          body: `${body}\n\nSent to: ${teacher.email}`,
          type: "EXAM_REMINDER_EMAIL",
          userId: row.teacherUserId,
        });
        emailSent = true;
      }
    }

    await this.recordExamAudit(schoolId, actor, "EXAM_REMINDER_SENT", examId, {
      subjectId,
      subject: row.subject,
      teacherName: row.teacherName,
      sms: smsSent,
      email: emailSent,
    });

    return {
      success: true,
      channels: {
        inApp: true,
        sms: smsSent,
        email: emailSent,
      },
      teacherName: row.teacherName,
    };
  }

  /** Class-level result management overview. */
  async resultsClassesOverview(schoolId: string, academicYearId?: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const exams = await tx.exam.findMany({
        where: {
          ...(academicYearId ? { academicYearId } : {}),
          status: { not: "ARCHIVED" },
        },
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const byClass = new Map<
        string,
        {
          classId: string;
          className: string;
          sectionIds: Set<string>;
          exams: typeof exams;
        }
      >();

      for (const exam of exams) {
        let entry = byClass.get(exam.classId);
        if (!entry) {
          entry = {
            classId: exam.classId,
            className: exam.class.name,
            sectionIds: new Set(),
            exams: [],
          };
          byClass.set(exam.classId, entry);
        }
        if (exam.sectionId) entry.sectionIds.add(exam.sectionId);
        entry.exams.push(exam);
      }

      const result = [];
      for (const entry of byClass.values()) {
        const [studentCount, sectionCount] = await Promise.all([
          tx.student.count({
            where: { classId: entry.classId, status: "ACTIVE" },
          }),
          tx.section.count({ where: { classId: entry.classId } }),
        ]);
        const published = entry.exams.some((e) => e.status === "PUBLISHED");
        const teacherLocked = entry.exams.some(
          (e) => e.status === "LOCKED" || e.status === "PUBLISHED",
        );
        result.push({
          classId: entry.classId,
          className: entry.className,
          sectionCount: sectionCount || entry.sectionIds.size || 1,
          studentCount,
          published,
          teacherLocked,
          studentPortalOpen: published,
          examCount: entry.exams.length,
          exams: entry.exams.map((e) => ({
            id: e.id,
            name: e.name,
            status: e.status,
            section: e.section?.name ?? null,
          })),
        });
      }

      return result.sort((a, b) => a.className.localeCompare(b.className));
    });
  }

  /** Student result matrix for one class + exam (+ optional section). */
  async classResultsMatrix(
    schoolId: string,
    opts: {
      classId: string;
      examId: string;
      sectionId?: string;
      search?: string;
      sortBy?: string;
      sortDir?: "asc" | "desc";
    },
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const exam = await tx.exam.findFirst({
        where: { id: opts.examId, classId: opts.classId },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
          academicYear: { select: { id: true, name: true } },
          subjects: {
            include: { subject: { select: { id: true, name: true } } },
            orderBy: { subject: { name: "asc" } },
          },
        },
      });
      if (!exam) throw new NotFoundException("Exam not found for this class");

      const sectionFilter = opts.sectionId ?? exam.sectionId ?? undefined;
      const students = await tx.student.findMany({
        where: {
          classId: opts.classId,
          ...(sectionFilter ? { sectionId: sectionFilter } : {}),
          status: "ACTIVE",
        },
        select: { id: true, code: true, fullName: true, sectionId: true },
        orderBy: { fullName: "asc" },
      });

      const marks = await tx.examMark.findMany({
        where: { examId: exam.id },
      });
      const markMap = new Map(
        marks.map((m) => [`${m.studentId}_${m.subjectId}`, m.marks]),
      );

      const subjectCols = exam.subjects.map((es) => ({
        subjectId: es.subjectId,
        name: es.subject.name,
      }));

      let rows = students.map((st) => {
        const subjectMarks: Record<string, number | null> = {};
        const missingSubjects: string[] = [];
        let totalObtained = 0;
        let markedCount = 0;

        for (const col of subjectCols) {
          const val = markMap.get(`${st.id}_${col.subjectId}`) ?? null;
          subjectMarks[col.subjectId] = val;
          if (val === null) missingSubjects.push(col.name);
          else {
            totalObtained += val;
            markedCount += 1;
          }
        }

        const totalMax = subjectCols.length * exam.maxMarks;
        const average = totalMax
          ? Math.round((totalObtained / totalMax) * 1000) / 10
          : 0;
        const grade = markedCount ? gradeFromAverage(average) : "—";
        const passed = markedCount > 0 ? average >= 50 : false;
        const complete = missingSubjects.length === 0;

        return {
          studentId: st.id,
          studentCode: st.code,
          studentName: st.fullName,
          subjectMarks,
          totalObtained,
          totalMax,
          average,
          grade,
          passed,
          remark: !markedCount ? "—" : passed ? "Pass" : "Fail",
          missingSubjects,
          complete,
        };
      });

      const q = opts.search?.trim().toLowerCase();
      if (q) {
        rows = rows.filter(
          (r) =>
            r.studentCode.toLowerCase().includes(q) ||
            r.studentName.toLowerCase().includes(q),
        );
      }

      const dir = opts.sortDir === "desc" ? -1 : 1;
      const sortBy = opts.sortBy ?? "name";
      rows.sort((a, b) => {
        switch (sortBy) {
          case "total":
            return (a.totalObtained - b.totalObtained) * dir;
          case "average":
            return (a.average - b.average) * dir;
          case "grade":
            return a.grade.localeCompare(b.grade) * dir;
          case "name":
          default:
            return a.studentName.localeCompare(b.studentName) * dir;
        }
      });

      const completed = rows.filter((r) => r.complete).length;
      const incomplete = rows.length - completed;

      return {
        exam: {
          id: exam.id,
          name: exam.name,
          status: exam.status,
          maxMarks: exam.maxMarks,
          className: exam.class.name,
          sectionName: exam.section?.name ?? null,
          academicYear: exam.academicYear.name,
          teacherLocked: exam.status === "LOCKED" || exam.status === "PUBLISHED",
          studentPortalOpen: exam.status === "PUBLISHED",
        },
        subjects: subjectCols,
        summary: {
          totalStudents: rows.length,
          completed,
          incomplete,
          completionPercent: rows.length
            ? Math.round((completed / rows.length) * 100)
            : 0,
        },
        rows,
      };
    });
  }

  private async buildMonitoringRows(
    schoolId: string,
    opts: {
      examId?: string;
      academicYearId?: string;
      classId?: string;
      sectionId?: string;
      subjectId?: string;
    },
  ): Promise<MonitoringDetailRow[]> {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const exams = await tx.exam.findMany({
        where: {
          ...(opts.examId ? { id: opts.examId } : {}),
          ...(opts.academicYearId ? { academicYearId: opts.academicYearId } : {}),
          ...(opts.classId ? { classId: opts.classId } : {}),
          ...(opts.sectionId ? { sectionId: opts.sectionId } : {}),
          status: { notIn: ["ARCHIVED", "DRAFT"] },
        },
        include: {
          class: { select: { name: true, id: true } },
          section: { select: { name: true, id: true } },
          academicYear: { select: { id: true } },
          subjects: {
            ...(opts.subjectId ? { where: { subjectId: opts.subjectId } } : {}),
            include: {
              subject: { select: { name: true, id: true } },
            },
          },
        },
      });

      const rows: MonitoringDetailRow[] = [];
      for (const exam of exams) {
        for (const sub of exam.subjects) {
          let teacherId: string | null = sub.teacherId;
          let teacherName: string | null = null;
          let teacherUserId: string | null = null;

          if (teacherId) {
            const teacher = await tx.teacher.findFirst({
              where: { id: teacherId },
              select: { fullName: true, userId: true },
            });
            teacherName = teacher?.fullName ?? null;
            teacherUserId = teacher?.userId ?? null;
          }
          if (!teacherName) {
            const assignment = await tx.teacherAssignment.findFirst({
              where: {
                academicYearId: exam.academicYear.id,
                classId: exam.class.id,
                subjectId: sub.subject.id,
                OR: [
                  { sectionId: exam.section?.id ?? null },
                  { sectionId: null },
                ],
              },
              orderBy: { sectionId: "desc" },
              include: {
                teacher: { select: { id: true, fullName: true, userId: true } },
              },
            });
            teacherId = assignment?.teacher.id ?? null;
            teacherName = assignment?.teacher.fullName ?? null;
            teacherUserId = assignment?.teacher.userId ?? null;
          }

          rows.push({
            examId: exam.id,
            examName: exam.name,
            classId: exam.class.id,
            className: exam.class.name,
            sectionId: exam.section?.id ?? null,
            section: exam.section?.name ?? null,
            subjectId: sub.subject.id,
            subject: sub.subject.name,
            examSubjectId: sub.id,
            teacherId,
            teacherName,
            teacherUserId,
            status: sub.submissionStatus,
            submittedAt: sub.submittedAt,
          });
        }
      }
      return rows;
    });
  }

  blockStudent(schoolId: string, dto: BlockStudentInput, userId?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.blockedStudent.create({
        data: {
          schoolId,
          studentId: dto.studentId,
          examId: dto.examId ?? null,
          academicYearId: dto.academicYearId,
          reason: dto.reason,
          blockedByUserId: userId ?? null,
        },
      }),
    );
  }

  listBlocked(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.blockedStudent.findMany({
        include: {
          student: { select: { code: true, fullName: true } },
          exam: { select: { name: true } },
        },
        orderBy: { blockedAt: "desc" },
      }),
    );
  }

  async studentResults(schoolId: string, studentId: string, academicYearId?: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId },
        include: {
          class: { select: { name: true, academicYearId: true } },
          section: { select: { name: true } },
        },
      });
      if (!student) throw new NotFoundException("Student not found");

      const yearId = academicYearId ?? student.class.academicYearId;
      const exams = await tx.exam.findMany({
        where: {
          academicYearId: yearId,
          classId: student.classId,
          sectionId: student.sectionId,
          status: "PUBLISHED",
        },
        include: {
          subjects: { include: { subject: { select: { name: true } } } },
        },
      });

      const marks = await tx.examMark.findMany({
        where: { studentId, exam: { academicYearId: yearId, status: "PUBLISHED" } },
      });
      const markMap = new Map(
        marks.map((m) => [`${m.examId}_${m.subjectId}`, m.marks]),
      );

      const termResults = exams.map((exam) => {
        const subjects = exam.subjects.map((es) => {
          const obtained = markMap.get(`${exam.id}_${es.subjectId}`) ?? null;
          return {
            subject: es.subject.name,
            maxMarks: exam.maxMarks,
            marksObtained: obtained,
            grade: obtained !== null ? gradeFromAverage((obtained / exam.maxMarks) * 100) : "—",
          };
        });
        const valid = subjects.filter((s) => s.marksObtained !== null);
        const totalObtained = valid.reduce((s, x) => s + (x.marksObtained ?? 0), 0);
        const totalMax = valid.length * exam.maxMarks;
        const average = totalMax ? (totalObtained / totalMax) * 100 : 0;
        return {
          examId: exam.id,
          examName: exam.name,
          term: exam.term,
          weightPercent: exam.weightPercent,
          subjects,
          totalObtained,
          totalMax,
          average: Math.round(average * 10) / 10,
          grade: gradeFromAverage(average),
          passed: average >= 50,
        };
      });

      const finalAverage =
        termResults.length === 0
          ? 0
          : termResults.reduce((s, t) => s + t.average, 0) / termResults.length;

      return {
        studentId: student.id,
        studentCode: student.code,
        studentName: student.fullName,
        className: student.class.name,
        section: student.section?.name ?? null,
        academicYearId: yearId,
        termResults,
        finalAverage: Math.round(finalAverage * 10) / 10,
        finalGrade: gradeFromAverage(finalAverage),
        passed: finalAverage >= 50,
      };
    });
  }

  async publicResultByCode(schoolId: string, code: string, academicYearName?: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { code, status: { in: ["ACTIVE", "GRADUATED"] } },
        select: { id: true },
      });
      if (!student) throw new NotFoundException("Student not found");

      let yearId: string | undefined;
      if (academicYearName) {
        const year = await tx.academicYear.findFirst({
          where: { name: academicYearName },
          select: { id: true },
        });
        yearId = year?.id;
      }
      return this.studentResults(schoolId, student.id, yearId);
    });
  }

  dashboard(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [total, draft, active, locked, published, groups, pending, completed] =
        await Promise.all([
          tx.exam.count(),
          tx.exam.count({ where: { status: "DRAFT" } }),
          tx.exam.count({
            where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
          }),
          tx.exam.count({ where: { status: "LOCKED" } }),
          tx.exam.count({ where: { status: "PUBLISHED" } }),
          tx.examGroup.count(),
          tx.examSubject.count({ where: { submissionStatus: "PENDING" } }),
          tx.examSubject.count({ where: { submissionStatus: "SUBMITTED" } }),
        ]);
      return {
        totalExams: total,
        draftExams: draft,
        activeExams: active,
        lockedExams: locked,
        publishedExams: published,
        examGroups: groups,
        pendingSubmissions: pending,
        completedSubmissions: completed,
        resultPublications: published,
      };
    });
  }

  async transcriptPdf(
    schoolId: string,
    studentId: string,
    academicYearId?: string,
  ): Promise<Buffer> {
    const results = await this.studentResults(schoolId, studentId, academicYearId);
    const rows: Record<string, string | number>[] = [];
    for (const term of results.termResults) {
      for (const sub of term.subjects) {
        rows.push({
          exam: term.examName,
          term: term.term,
          subject: sub.subject,
          marks: sub.marksObtained ?? "—",
          max: sub.maxMarks,
          grade: sub.grade,
        });
      }
    }
    return this.docs.buildPdfReport({
      title: "Academic Transcript",
      subtitle: `${results.studentName} (${results.studentCode}) — ${results.className}${results.section ? ` / ${results.section}` : ""}`,
      columns: [
        { key: "exam", label: "Exam", width: 110 },
        { key: "term", label: "Term", width: 60 },
        { key: "subject", label: "Subject", width: 100 },
        { key: "marks", label: "Marks", width: 50 },
        { key: "max", label: "Max", width: 40 },
        { key: "grade", label: "Grade", width: 50 },
      ],
      rows,
    });
  }

  /** Subjects assigned via TeacherAssignment for a class/section/year. */
  private async assignmentSubjects(
    tx: Parameters<Parameters<PrismaService["forTenant"]>[1]>[0],
    schoolId: string,
    academicYearId: string,
    classId: string,
    sectionId: string | null,
  ) {
    const assignments = await tx.teacherAssignment.findMany({
      where: {
        schoolId,
        academicYearId,
        classId,
        OR: [
          { sectionId: sectionId ?? null },
          { sectionId: null },
        ],
      },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true } },
      },
      orderBy: { sectionId: "desc" },
    });
    const seen = new Set<string>();
    const subjects: {
      subjectId: string;
      subjectName: string;
      teacherId: string | null;
      teacherName: string | null;
    }[] = [];
    for (const a of assignments) {
      if (seen.has(a.subjectId)) continue;
      seen.add(a.subjectId);
      subjects.push({
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        teacherId: a.teacher?.id ?? null,
        teacherName: a.teacher?.fullName ?? null,
      });
    }
    return subjects;
  }

  /** Expand targets and build a creation preview with validation. */
  async previewBulkCreation(schoolId: string, dto: ExamCreationBulkInput) {
    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { id: dto.academicYearId },
      });
      if (!year) throw new NotFoundException("Academic year not found");

      const instances: {
        classId: string;
        className: string;
        sectionId: string | null;
        sectionName: string | null;
        studentCount: number;
        subjects: {
          subjectId: string;
          subjectName: string;
          teacherName: string | null;
        }[];
        duplicate: boolean;
        skipped: boolean;
        skipReason?: string;
      }[] = [];

      let totalStudents = 0;

      // Batch every lookup up-front. A per-target query loop here runs ~5×N
      // round-trips inside one transaction and expires on a slow pooler once the
      // admin selects many classes/sections ("Could not load preview").
      const classIds = [...new Set(dto.targets.map((t) => t.classId))];
      const sectionIds = [
        ...new Set(
          dto.targets
            .map((t) => t.sectionId)
            .filter((id): id is string => !!id),
        ),
      ];

      const [clsRows, secRows, assignments, studentGroups, existingExams] =
        await Promise.all([
          tx.class.findMany({
            where: { id: { in: classIds } },
            select: { id: true, name: true },
          }),
          sectionIds.length
            ? tx.section.findMany({
                where: { id: { in: sectionIds } },
                select: { id: true, name: true },
              })
            : Promise.resolve([] as { id: string; name: string }[]),
          tx.teacherAssignment.findMany({
            where: {
              academicYearId: dto.academicYearId,
              classId: { in: classIds },
            },
            include: {
              subject: { select: { id: true, name: true } },
              teacher: { select: { id: true, fullName: true } },
            },
            orderBy: { sectionId: "desc" },
          }),
          tx.student.groupBy({
            by: ["classId", "sectionId"],
            where: { status: "ACTIVE", classId: { in: classIds } },
            _count: { _all: true },
          }),
          tx.exam.findMany({
            where: {
              academicYearId: dto.academicYearId,
              name: dto.name,
              term: dto.term,
              classId: { in: classIds },
            },
            select: { classId: true, sectionId: true },
          }),
        ]);

      const classById = new Map(clsRows.map((c) => [c.id, c]));
      const sectionById = new Map(secRows.map((s) => [s.id, s]));

      const sectionCount = new Map<string, number>();
      const classCount = new Map<string, number>();
      for (const g of studentGroups) {
        const n = g._count._all;
        classCount.set(g.classId, (classCount.get(g.classId) ?? 0) + n);
        if (g.sectionId) sectionCount.set(`${g.classId}|${g.sectionId}`, n);
      }

      const assignmentsByClass = new Map<string, typeof assignments>();
      for (const a of assignments) {
        const list = assignmentsByClass.get(a.classId) ?? [];
        list.push(a);
        assignmentsByClass.set(a.classId, list);
      }
      const subjectsFor = (classId: string, sectionId: string | null) => {
        const seen = new Set<string>();
        const out: { subjectId: string; subjectName: string; teacherName: string | null }[] = [];
        for (const a of assignmentsByClass.get(classId) ?? []) {
          if (a.sectionId !== sectionId && a.sectionId !== null) continue;
          if (seen.has(a.subjectId)) continue;
          seen.add(a.subjectId);
          out.push({
            subjectId: a.subjectId,
            subjectName: a.subject.name,
            teacherName: a.teacher?.fullName ?? null,
          });
        }
        return out;
      };

      const existingSet = new Set(
        existingExams.map((e) => `${e.classId}|${e.sectionId ?? ""}`),
      );

      for (const target of dto.targets) {
        const cls = classById.get(target.classId);
        if (!cls) continue;

        const section = target.sectionId
          ? sectionById.get(target.sectionId)
          : null;
        const subjects = subjectsFor(target.classId, target.sectionId ?? null);
        const studentCount = target.sectionId
          ? sectionCount.get(`${target.classId}|${target.sectionId}`) ?? 0
          : classCount.get(target.classId) ?? 0;
        const duplicate = existingSet.has(
          `${target.classId}|${target.sectionId ?? ""}`,
        );

        const skipped = subjects.length === 0;
        instances.push({
          classId: target.classId,
          className: cls.name,
          sectionId: target.sectionId,
          sectionName: section?.name ?? (target.sectionId ? null : "All"),
          studentCount,
          subjects,
          duplicate,
          skipped,
          skipReason: skipped
            ? "No assigned subjects for this class/section"
            : duplicate
              ? "Duplicate exam already exists for this year and term"
              : undefined,
        });
        if (!skipped && !duplicate) totalStudents += studentCount;
      }

      const creatable = instances.filter((i) => !i.skipped && !i.duplicate);

      return {
        academicYear: year.name,
        name: dto.name,
        examType: dto.examType,
        term: dto.term,
        examGroupId: dto.examGroupId,
        maxMarks: dto.maxMarks,
        weightPercent: dto.weightPercent,
        startDate: dto.startDate,
        endDate: dto.endDate,
        instances,
        creatableCount: creatable.length,
        totalStudents,
        subjectCount: creatable.reduce((n, i) => n + i.subjects.length, 0),
        canCreate: creatable.length > 0,
      };
    },
      { timeout: 120_000, maxWait: 60_000 },
    );
  }

  /** Create exams for many class/section targets; subjects auto-loaded. */
  async createExamsBulk(
    schoolId: string,
    dto: ExamCreationBulkInput,
    userId?: string,
    role?: string,
  ) {
    if (role === "TEACHER") {
      throw new ForbiddenException(
        "Teachers cannot create official school examinations",
      );
    }
    const preview = await this.previewBulkCreation(schoolId, dto);
    if (!preview.canCreate) {
      throw new BadRequestException(
        "No valid exam instances to create. Check subjects and duplicates.",
      );
    }

    const created = [];
    for (const inst of preview.instances) {
      if (inst.skipped || inst.duplicate) continue;

      const exam = await this.createExam(
        schoolId,
        {
          name: dto.name,
          academicYearId: dto.academicYearId,
          examGroupId: dto.examGroupId ?? null,
          examType: dto.examType,
          term: dto.term,
          maxMarks: dto.maxMarks,
          weightPercent: dto.weightPercent,
          startDate: dto.startDate,
          endDate: dto.endDate,
          classId: inst.classId,
          sectionId: inst.sectionId,
          subjectIds: inst.subjects.map((s) => s.subjectId),
        },
        userId,
        role,
      );
      created.push(exam);
    }

    return { created, count: created.length };
  }

  /** Delete only DRAFT exams with no submitted marks. */
  async deleteExam(schoolId: string, examId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const exam = await tx.exam.findFirst({
        where: { id: examId },
        include: { _count: { select: { marks: true } } },
      });
      if (!exam) throw new NotFoundException("Exam not found");

      if (exam.status !== "DRAFT") {
        throw new BadRequestException(
          "Only draft examinations can be deleted. Archive instead.",
        );
      }
      if (exam._count.marks > 0) {
        throw new BadRequestException(
          "This examination contains submitted marks and cannot be deleted. Please archive the examination instead.",
        );
      }

      await tx.exam.delete({ where: { id: examId } });
      return { success: true };
    });
  }

  /** Branded PDF export for class result matrix. */
  async exportClassResultsPdf(
    schoolId: string,
    opts: {
      classId: string;
      examId: string;
      sectionId?: string;
      search?: string;
      sortBy?: string;
      sortDir?: "asc" | "desc";
    },
    preparedBy?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const matrix = await this.classResultsMatrix(schoolId, opts);
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId },
      select: { name: true, logoKey: true, resultFooter: true },
    });
    let logoBuffer: Buffer | null = null;
    if (school?.logoKey) {
      try {
        const bucket = this.config.get<string>("MINIO_BUCKET") ?? "ekulmis";
        logoBuffer = await this.storage.getObject(bucket, school.logoKey);
      } catch {
        logoBuffer = null;
      }
    }

    const columns = [
      { key: "code", label: "Student ID", width: 70 },
      { key: "name", label: "Student Name", width: 120 },
      ...matrix.subjects.map((s) => ({
        key: s.subjectId,
        label: s.name,
        width: 56,
      })),
      { key: "total", label: "Total", width: 48 },
      { key: "average", label: "Avg", width: 40 },
      { key: "grade", label: "Grade", width: 40 },
      { key: "remark", label: "Remark", width: 48 },
    ];

    const rows = matrix.rows.map((r) => {
      const row: Record<string, string | number> = {
        code: r.studentCode,
        name: r.studentName,
        total: r.totalObtained,
        average: r.average.toFixed(1),
        grade: r.grade,
        remark: r.remark,
      };
      for (const s of matrix.subjects) {
        row[s.subjectId] = r.subjectMarks[s.subjectId] ?? "—";
      }
      return row;
    });

    const sectionLabel = matrix.exam.sectionName
      ? ` · Section ${matrix.exam.sectionName}`
      : "";
    const buffer = await this.docs.buildBrandedPdfReport({
      schoolName: school?.name,
      logoBuffer,
      title: "Class Examination Results",
      headerLines: [
        `${matrix.exam.academicYear} · ${matrix.exam.name}`,
        `${matrix.exam.className}${sectionLabel}`,
        `Completion: ${matrix.summary.completionPercent}% (${matrix.summary.completed}/${matrix.summary.totalStudents} students)`,
      ],
      columns,
      rows,
      footer: school?.resultFooter ?? undefined,
      preparedBy,
    });

    const filename = `${matrix.exam.name}-${matrix.exam.className}-results.pdf`
      .replace(/\s+/g, "-")
      .toLowerCase();
    return { buffer, filename };
  }

  /** Branded Excel export for class result matrix. */
  async exportClassResultsExcel(
    schoolId: string,
    opts: {
      classId: string;
      examId: string;
      sectionId?: string;
      search?: string;
      sortBy?: string;
      sortDir?: "asc" | "desc";
    },
    preparedBy?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const matrix = await this.classResultsMatrix(schoolId, opts);
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId },
      select: { name: true, resultFooter: true },
    });

    const sectionLabel = matrix.exam.sectionName
      ? ` · Section ${matrix.exam.sectionName}`
      : "";
    const columns = [
      { key: "code", label: "Student ID" },
      { key: "name", label: "Student Name" },
      ...matrix.subjects.map((s) => ({ key: s.subjectId, label: s.name })),
      { key: "total", label: "Total" },
      { key: "average", label: "Average" },
      { key: "grade", label: "Grade" },
      { key: "remark", label: "Remark" },
    ];

    const rows = matrix.rows.map((r) => {
      const row: Record<string, string | number> = {
        code: r.studentCode,
        name: r.studentName,
        total: r.totalObtained,
        average: r.average.toFixed(1),
        grade: r.grade,
        remark: r.remark,
      };
      for (const s of matrix.subjects) {
        row[s.subjectId] = r.subjectMarks[s.subjectId] ?? "";
      }
      return row;
    });

    const buffer = await this.docs.buildBrandedExcelReport({
      sheetName: "Results",
      headerLines: [
        school?.name ?? "School",
        `${matrix.exam.academicYear} · ${matrix.exam.name}`,
        `${matrix.exam.className}${sectionLabel}`,
        preparedBy ? `Prepared by: ${preparedBy}` : "",
        `Date: ${new Date().toLocaleDateString()}`,
      ].filter(Boolean),
      columns,
      rows,
    });

    const filename = `${matrix.exam.name}-${matrix.exam.className}-results.xlsx`
      .replace(/\s+/g, "-")
      .toLowerCase();
    return { buffer, filename };
  }

  private async recordExamAudit(
    schoolId: string,
    actor: Pick<AuthUser, "userId" | "username" | "role"> | undefined,
    action: string,
    examId: string,
    extra?: Record<string, unknown>,
  ) {
    const exam = await this.prisma.forTenant(schoolId, (tx) =>
      tx.exam.findFirst({
        where: { id: examId },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      }),
    );
    await this.audit.record({
      schoolId,
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
      role: actor?.role ?? null,
      module: "examinations",
      action,
      metadata: {
        examId,
        examName: exam?.name,
        className: exam?.class.name,
        section: exam?.section?.name ?? null,
        ...extra,
      },
    });
  }
}
