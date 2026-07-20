import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ExaminationsService } from "../examinations/examinations.service";
import type { ReportData } from "./fee-reports.service";

export interface ExamReportFilters {
  examId?: string;
  className?: string;
  section?: string;
  subject?: string;
  term?: string;
  search?: string;
}

/**
 * Examination reports, computed from the database.
 *
 * These are the most complex of the report categories because they aggregate
 * marks into totals, averages, grades and ranks — so rather than re-derive that
 * arithmetic here, they reuse ExaminationsService.classResultsMatrix, the exact
 * engine behind the on-screen results and the results PDF. One computation of
 * "what did this student score" keeps a report, the results page and the
 * printout from ever disagreeing.
 *
 * An exam belongs to one class, so every report here needs an examId. Without
 * one there is nothing to aggregate, so the report asks for it rather than
 * guessing.
 */
@Injectable()
export class ExamReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: ExaminationsService,
  ) {}

  /** Exams for the picker — the report dropdown must come from the database. */
  listExams(schoolId: string, academicYearId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.exam.findMany({
        where: { academicYearId },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          term: true,
          status: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      }),
    );
  }

  async build(
    schoolId: string,
    slug: string,
    filters: ExamReportFilters,
  ): Promise<ReportData> {
    if (slug === "submission-status") {
      return this.submissionStatus(schoolId, filters);
    }
    if (!filters.examId) {
      return {
        columns: [],
        rows: [],
        summary: [{ label: "Pick an exam", value: "to run this report" }],
      };
    }

    const matrix = await this.matrixFor(schoolId, filters.examId, filters);

    switch (slug) {
      case "subject-results":
        return this.subjectResults(matrix, filters);
      case "rankings":
        return this.rankings(matrix);
      case "grade-distribution":
        return this.gradeDistribution(matrix);
      case "pass-fail":
        return this.passFail(matrix);
      default:
        return this.results(matrix);
    }
  }

  /** Resolve the exam's class, then run the shared results engine. */
  private async matrixFor(
    schoolId: string,
    examId: string,
    filters: ExamReportFilters,
  ) {
    const exam = await this.prisma.forTenant(schoolId, (tx) =>
      tx.exam.findFirst({
        where: { id: examId },
        select: { id: true, classId: true },
      }),
    );
    if (!exam) throw new BadRequestException("Exam not found.");
    return this.exams.classResultsMatrix(schoolId, {
      classId: exam.classId,
      examId,
      search: filters.search,
    });
  }

  private results(matrix: MatrixResult): ReportData {
    return {
      columns: [
        { key: "code", label: "Student ID", mono: true },
        { key: "name", label: "Student" },
        ...matrix.subjects.map((s) => ({ key: s.subjectId, label: s.name, align: "right" as const })),
        { key: "total", label: "Total", align: "right" as const },
        { key: "average", label: "Average", align: "right" as const },
        { key: "grade", label: "Grade" },
        { key: "remark", label: "Result" },
      ],
      rows: matrix.rows.map((r) => ({
        code: r.studentCode,
        name: r.studentName,
        ...Object.fromEntries(
          matrix.subjects.map((s) => [
            s.subjectId,
            r.subjectMarks[s.subjectId] ?? "—",
          ]),
        ),
        total: r.totalObtained,
        average: `${r.average}%`,
        grade: r.grade,
        remark: r.remark,
      })),
      summary: [
        { label: "Students", value: String(matrix.rows.length) },
        {
          label: "Passed",
          value: String(matrix.rows.filter((r) => r.passed).length),
        },
      ],
    };
  }

  private subjectResults(matrix: MatrixResult, filters: ExamReportFilters): ReportData {
    const subjects = filters.subject
      ? matrix.subjects.filter((s) => s.name === filters.subject)
      : matrix.subjects;

    const rows = subjects.map((subject) => {
      const marks = matrix.rows
        .map((r) => r.subjectMarks[subject.subjectId])
        .filter((m): m is number => typeof m === "number");
      const sum = marks.reduce((a, b) => a + b, 0);
      const avg = marks.length ? Math.round((sum / marks.length) * 10) / 10 : 0;
      const passed = marks.filter((m) => m >= matrix.exam.maxMarks * 0.5).length;
      return {
        subject: subject.name,
        entered: marks.length,
        average: marks.length ? `${avg}` : "—",
        highest: marks.length ? Math.max(...marks) : "—",
        lowest: marks.length ? Math.min(...marks) : "—",
        passed,
      };
    });

    return {
      columns: [
        { key: "subject", label: "Subject" },
        { key: "entered", label: "Marks entered", align: "right" },
        { key: "average", label: "Average", align: "right" },
        { key: "highest", label: "Highest", align: "right" },
        { key: "lowest", label: "Lowest", align: "right" },
        { key: "passed", label: "Passed", align: "right" },
      ],
      rows,
      summary: [{ label: "Subjects", value: String(rows.length) }],
    };
  }

  private rankings(matrix: MatrixResult): ReportData {
    const ranked = [...matrix.rows]
      .filter((r) => r.complete)
      .sort((a, b) => b.average - a.average);
    return {
      columns: [
        { key: "rank", label: "Rank", align: "right" },
        { key: "code", label: "Student ID", mono: true },
        { key: "name", label: "Student" },
        { key: "total", label: "Total", align: "right" },
        { key: "average", label: "Average", align: "right" },
        { key: "grade", label: "Grade" },
      ],
      rows: ranked.map((r, i) => ({
        rank: i + 1,
        code: r.studentCode,
        name: r.studentName,
        total: r.totalObtained,
        average: `${r.average}%`,
        grade: r.grade,
      })),
      summary: [
        { label: "Ranked", value: String(ranked.length) },
        {
          label: "Excluded (incomplete)",
          value: String(matrix.rows.length - ranked.length),
        },
      ],
    };
  }

  private gradeDistribution(matrix: MatrixResult): ReportData {
    const counts = new Map<string, number>();
    for (const r of matrix.rows) {
      if (r.grade === "—") continue;
      counts.set(r.grade, (counts.get(r.grade) ?? 0) + 1);
    }
    const order = ["A+", "A", "B", "C", "D", "F"];
    return {
      columns: [
        { key: "grade", label: "Grade" },
        { key: "count", label: "Students", align: "right" },
      ],
      rows: order
        .filter((g) => counts.has(g))
        .map((g) => ({ grade: g, count: counts.get(g)! })),
      summary: [
        {
          label: "Graded",
          value: String([...counts.values()].reduce((a, b) => a + b, 0)),
        },
      ],
    };
  }

  private passFail(matrix: MatrixResult): ReportData {
    const graded = matrix.rows.filter((r) => r.grade !== "—");
    const passed = graded.filter((r) => r.passed).length;
    const failed = graded.length - passed;
    const rate = graded.length ? Math.round((passed / graded.length) * 1000) / 10 : 0;
    return {
      columns: [
        { key: "metric", label: "Result" },
        { key: "count", label: "Students", align: "right" },
      ],
      rows: [
        { metric: "Passed", count: passed },
        { metric: "Failed", count: failed },
      ],
      summary: [
        { label: "Graded", value: String(graded.length) },
        { label: "Pass rate", value: `${rate}%` },
      ],
    };
  }

  private async submissionStatus(
    schoolId: string,
    filters: ExamReportFilters,
  ): Promise<ReportData> {
    if (!filters.examId) {
      return {
        columns: [],
        rows: [],
        summary: [{ label: "Pick an exam", value: "to run this report" }],
      };
    }
    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.examSubject.findMany({
        where: { examId: filters.examId },
        include: {
          subject: { select: { name: true } },
          exam: { select: { class: { select: { name: true } } } },
        },
      }),
    );

    // Which teacher owns each subject comes from the assignment, not the exam
    // row, so a subject with no submitted marks still shows who is responsible.
    return {
      columns: [
        { key: "className", label: "Class" },
        { key: "subject", label: "Subject" },
        { key: "status", label: "Submission" },
        { key: "submittedAt", label: "Submitted" },
      ],
      rows: rows.map((r) => ({
        className: r.exam.class?.name ?? "",
        subject: r.subject.name,
        status: r.submissionStatus,
        submittedAt: r.submittedAt ? r.submittedAt.toISOString().slice(0, 10) : "—",
      })),
      summary: [
        { label: "Subjects", value: String(rows.length) },
        {
          label: "Submitted",
          value: String(rows.filter((r) => r.submissionStatus === "SUBMITTED").length),
        },
      ],
    };
  }
}

/** The shape classResultsMatrix returns, narrowed to what these reports use. */
type MatrixResult = {
  exam: { maxMarks: number };
  subjects: { subjectId: string; name: string }[];
  rows: {
    studentCode: string;
    studentName: string;
    subjectMarks: Record<string, number | null>;
    totalObtained: number;
    average: number;
    grade: string;
    passed: boolean;
    remark: string;
    complete: boolean;
  }[];
};
