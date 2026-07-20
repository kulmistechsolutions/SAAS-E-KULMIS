import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportData } from "./fee-reports.service";

export interface QuizReportFilters {
  className?: string;
  section?: string;
}

/**
 * Quiz reports, computed from the database rather than the browser's quiz
 * store (which only held whichever quizzes the quiz pages had loaded).
 */
@Injectable()
export class QuizReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    schoolId: string,
    slug: string,
    filters: QuizReportFilters,
  ): Promise<ReportData> {
    switch (slug) {
      case "attempts":
        return this.attempts(schoolId, filters);
      case "averages":
        return this.averages(schoolId, filters);
      case "completion":
        return this.completion(schoolId, filters);
      case "teacher-activity":
        return this.teacherActivity(schoolId);
      default:
        return this.results(schoolId, filters);
    }
  }

  private async results(
    schoolId: string,
    filters: QuizReportFilters,
  ): Promise<ReportData> {
    const attempts = await this.prisma.forTenant(schoolId, (tx) =>
      tx.quizAttempt.findMany({
        where: {
          quiz: {
            ...(filters.className ? { class: { name: filters.className } } : {}),
            ...(filters.section ? { section: { name: filters.section } } : {}),
          },
        },
        orderBy: { submittedAt: "desc" },
        select: {
          score: true,
          percentage: true,
          grade: true,
          status: true,
          submittedAt: true,
          student: { select: { code: true, fullName: true } },
          quiz: { select: { title: true, class: { select: { name: true } } } },
        },
      }),
    );

    return {
      columns: [
        { key: "code", label: "Student ID", mono: true },
        { key: "name", label: "Student" },
        { key: "quiz", label: "Quiz" },
        { key: "className", label: "Class" },
        { key: "score", label: "Score", align: "right" },
        { key: "percentage", label: "%", align: "right" },
        { key: "grade", label: "Grade" },
      ],
      rows: attempts.map((a) => ({
        code: a.student.code,
        name: a.student.fullName,
        quiz: a.quiz.title,
        className: a.quiz.class.name,
        score: a.score ?? "—",
        percentage: a.percentage != null ? `${a.percentage.toFixed(1)}%` : "—",
        grade: a.grade ?? "—",
      })),
      summary: [{ label: "Attempts", value: String(attempts.length) }],
    };
  }

  private async attempts(
    schoolId: string,
    filters: QuizReportFilters,
  ): Promise<ReportData> {
    const quizzes = await this.prisma.forTenant(schoolId, (tx) =>
      tx.quiz.findMany({
        where: {
          ...(filters.className ? { class: { name: filters.className } } : {}),
          ...(filters.section ? { section: { name: filters.section } } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: {
          title: true,
          status: true,
          class: { select: { name: true } },
          _count: { select: { attempts: true } },
        },
      }),
    );
    return {
      columns: [
        { key: "quiz", label: "Quiz" },
        { key: "className", label: "Class" },
        { key: "status", label: "Status" },
        { key: "attempts", label: "Attempts", align: "right" },
      ],
      rows: quizzes.map((q) => ({
        quiz: q.title,
        className: q.class.name,
        status: q.status,
        attempts: q._count.attempts,
      })),
      summary: [
        { label: "Quizzes", value: String(quizzes.length) },
        {
          label: "Total attempts",
          value: String(quizzes.reduce((s, q) => s + q._count.attempts, 0)),
        },
      ],
    };
  }

  private async averages(
    schoolId: string,
    filters: QuizReportFilters,
  ): Promise<ReportData> {
    const attempts = await this.prisma.forTenant(schoolId, (tx) =>
      tx.quizAttempt.findMany({
        where: {
          percentage: { not: null },
          quiz: {
            ...(filters.className ? { class: { name: filters.className } } : {}),
            ...(filters.section ? { section: { name: filters.section } } : {}),
          },
        },
        select: {
          percentage: true,
          quiz: {
            select: { class: { select: { name: true } }, section: { select: { name: true } } },
          },
        },
      }),
    );
    const groups = new Map<string, { sum: number; count: number }>();
    for (const a of attempts) {
      const key = a.quiz.section
        ? `${a.quiz.class.name} ${a.quiz.section.name}`
        : a.quiz.class.name;
      const g = groups.get(key) ?? { sum: 0, count: 0 };
      g.sum += a.percentage ?? 0;
      g.count += 1;
      groups.set(key, g);
    }
    return {
      columns: [
        { key: "group", label: "Class" },
        { key: "average", label: "Average %", align: "right" },
        { key: "count", label: "Attempts", align: "right" },
      ],
      rows: [...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([group, g]) => ({
          group,
          average: `${(g.sum / g.count).toFixed(1)}%`,
          count: g.count,
        })),
      summary: [{ label: "Classes", value: String(groups.size) }],
    };
  }

  private async completion(
    schoolId: string,
    filters: QuizReportFilters,
  ): Promise<ReportData> {
    const quizzes = await this.prisma.forTenant(schoolId, (tx) =>
      tx.quiz.findMany({
        where: filters.className ? { class: { name: filters.className } } : {},
        select: {
          title: true,
          class: { select: { name: true } },
          attempts: { select: { status: true } },
        },
      }),
    );
    return {
      columns: [
        { key: "quiz", label: "Quiz" },
        { key: "className", label: "Class" },
        { key: "completed", label: "Completed", align: "right" },
        { key: "total", label: "Started", align: "right" },
        { key: "rate", label: "Completion", align: "right" },
      ],
      rows: quizzes.map((q) => {
        const total = q.attempts.length;
        const completed = q.attempts.filter(
          (a) => a.status === "SUBMITTED" || a.status === "GRADED",
        ).length;
        return {
          quiz: q.title,
          className: q.class.name,
          completed,
          total,
          rate: total ? `${((completed / total) * 100).toFixed(1)}%` : "—",
        };
      }),
      summary: [{ label: "Quizzes", value: String(quizzes.length) }],
    };
  }

  private async teacherActivity(schoolId: string): Promise<ReportData> {
    const quizzes = await this.prisma.forTenant(schoolId, (tx) =>
      tx.quiz.findMany({
        select: {
          teacher: { select: { code: true, fullName: true } },
          _count: { select: { attempts: true } },
        },
      }),
    );
    const byTeacher = new Map<string, { name: string; quizzes: number; attempts: number }>();
    for (const q of quizzes) {
      const key = q.teacher.code;
      const g = byTeacher.get(key) ?? { name: q.teacher.fullName, quizzes: 0, attempts: 0 };
      g.quizzes += 1;
      g.attempts += q._count.attempts;
      byTeacher.set(key, g);
    }
    return {
      columns: [
        { key: "code", label: "Teacher ID", mono: true },
        { key: "name", label: "Teacher" },
        { key: "quizzes", label: "Quizzes", align: "right" },
        { key: "attempts", label: "Attempts", align: "right" },
      ],
      rows: [...byTeacher.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([code, g]) => ({
          code,
          name: g.name,
          quizzes: g.quizzes,
          attempts: g.attempts,
        })),
      summary: [{ label: "Teachers", value: String(byTeacher.size) }],
    };
  }
}
