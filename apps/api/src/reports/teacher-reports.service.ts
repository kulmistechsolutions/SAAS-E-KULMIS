import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportData } from "./fee-reports.service";

export interface TeacherReportFilters {
  shift?: string;
  status?: string;
  className?: string;
  section?: string;
  subject?: string;
  search?: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Teacher reports, computed from the database.
 *
 * The list and salary reports read the teacher records; the assignment reports
 * read TeacherAssignment, which is the single source of who teaches what. The
 * browser versions rebuilt all of this from partially loaded stores, so a
 * report opened directly under-reported both teachers and their assignments.
 *
 * Teacher ATTENDANCE already had its own API report and is untouched here.
 */
@Injectable()
export class TeacherReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    schoolId: string,
    slug: string,
    filters: TeacherReportFilters,
  ): Promise<ReportData> {
    switch (slug) {
      case "salary":
        return this.salary(schoolId, filters);
      case "assignments":
      case "subjects":
      case "classes":
      case "sections":
        return this.assignments(schoolId, slug, filters);
      default:
        return this.list(schoolId, filters);
    }
  }

  private teacherWhere(filters: TeacherReportFilters): Prisma.TeacherWhereInput {
    const where: Prisma.TeacherWhereInput = {};
    if (filters.shift) where.shift = filters.shift as Prisma.TeacherWhereInput["shift"];
    if (filters.status) where.status = filters.status as Prisma.TeacherWhereInput["status"];
    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    return where;
  }

  private async list(
    schoolId: string,
    filters: TeacherReportFilters,
  ): Promise<ReportData> {
    const teachers = await this.prisma.forTenant(schoolId, (tx) =>
      tx.teacher.findMany({
        where: this.teacherWhere(filters),
        orderBy: [{ code: "asc" }],
        select: {
          code: true,
          fullName: true,
          gender: true,
          phone: true,
          email: true,
          qualification: true,
          shift: true,
          status: true,
        },
      }),
    );
    return {
      columns: [
        { key: "code", label: "Teacher ID", mono: true },
        { key: "name", label: "Teacher" },
        { key: "gender", label: "Gender" },
        { key: "phone", label: "Phone" },
        { key: "qualification", label: "Qualification" },
        { key: "shift", label: "Shift" },
        { key: "status", label: "Status" },
      ],
      rows: teachers.map((t) => ({
        code: t.code,
        name: t.fullName,
        gender: t.gender,
        phone: t.phone ?? "",
        qualification: t.qualification ?? "",
        shift: t.shift,
        status: t.status,
      })),
      summary: [{ label: "Teachers", value: String(teachers.length) }],
    };
  }

  private async salary(
    schoolId: string,
    filters: TeacherReportFilters,
  ): Promise<ReportData> {
    const teachers = await this.prisma.forTenant(schoolId, (tx) =>
      tx.teacher.findMany({
        where: this.teacherWhere(filters),
        orderBy: [{ code: "asc" }],
        select: {
          code: true,
          fullName: true,
          shift: true,
          status: true,
          salary: true,
        },
      }),
    );
    return {
      columns: [
        { key: "code", label: "Teacher ID", mono: true },
        { key: "name", label: "Teacher" },
        { key: "shift", label: "Shift" },
        { key: "status", label: "Status" },
        { key: "salary", label: "Monthly Salary", align: "right" },
      ],
      rows: teachers.map((t) => ({
        code: t.code,
        name: t.fullName,
        shift: t.shift,
        status: t.status,
        salary: money(t.salary),
      })),
      summary: [
        { label: "Teachers", value: String(teachers.length) },
        {
          label: "Monthly total",
          value: money(teachers.reduce((s, t) => s + t.salary, 0)),
        },
      ],
    };
  }

  /**
   * The assignment reports are all the same rows read at different widths:
   * "assignments" is teacher × class × subject, "subjects" collapses to what
   * each teacher teaches, "classes"/"sections" to where.
   */
  private async assignments(
    schoolId: string,
    slug: string,
    filters: TeacherReportFilters,
  ): Promise<ReportData> {
    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.teacherAssignment.findMany({
        where: {
          ...(filters.className ? { class: { name: filters.className } } : {}),
          ...(filters.section ? { section: { name: filters.section } } : {}),
          ...(filters.subject ? { subject: { name: filters.subject } } : {}),
        },
        select: {
          teacher: { select: { code: true, fullName: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
          academicYear: { select: { name: true } },
        },
      }),
    );

    // "subjects" / "classes" / "sections" are per-teacher summaries; dedupe the
    // grouped value so a teacher who takes Maths in three classes shows Maths
    // once, not three times.
    if (slug === "subjects" || slug === "classes" || slug === "sections") {
      const pick = (r: (typeof rows)[number]) =>
        slug === "subjects"
          ? r.subject.name
          : slug === "classes"
            ? (r.class?.name ?? "")
            : `${r.class?.name ?? ""} ${r.section?.name ?? ""}`.trim();

      const byTeacher = new Map<string, { name: string; values: Set<string> }>();
      for (const r of rows) {
        const key = r.teacher.code;
        const entry =
          byTeacher.get(key) ?? { name: r.teacher.fullName, values: new Set<string>() };
        const value = pick(r);
        if (value) entry.values.add(value);
        byTeacher.set(key, entry);
      }
      const label =
        slug === "subjects" ? "Subjects" : slug === "classes" ? "Classes" : "Sections";
      return {
        columns: [
          { key: "code", label: "Teacher ID", mono: true },
          { key: "name", label: "Teacher" },
          { key: "values", label },
          { key: "count", label: "Count", align: "right" },
        ],
        rows: [...byTeacher.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([code, e]) => ({
            code,
            name: e.name,
            values: [...e.values].sort().join(", "),
            count: e.values.size,
          })),
        summary: [{ label: "Teachers", value: String(byTeacher.size) }],
      };
    }

    return {
      columns: [
        { key: "code", label: "Teacher ID", mono: true },
        { key: "name", label: "Teacher" },
        { key: "className", label: "Class" },
        { key: "section", label: "Section" },
        { key: "subject", label: "Subject" },
        { key: "year", label: "Year" },
      ],
      rows: rows
        .map((r) => ({
          code: r.teacher.code,
          name: r.teacher.fullName,
          className: r.class?.name ?? "",
          section: r.section?.name ?? "",
          subject: r.subject.name,
          year: r.academicYear?.name ?? "",
        }))
        .sort(
          (a, b) =>
            a.code.localeCompare(b.code) ||
            a.className.localeCompare(b.className) ||
            a.subject.localeCompare(b.subject),
        ),
      summary: [{ label: "Assignments", value: String(rows.length) }],
    };
  }
}
