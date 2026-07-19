import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportData } from "./fee-reports.service";

export interface StudentReportFilters {
  className?: string;
  section?: string;
  gender?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

/**
 * Student and parent reports, computed from the database.
 *
 * Like the fee reports, these previously ran off the browser's student store,
 * which only held whatever the student pages had paged in — so a report opened
 * directly was missing rows nobody had scrolled to. Reading from the database
 * makes a report the whole register, not the part of it one tab remembered.
 */
@Injectable()
export class StudentReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    schoolId: string,
    slug: string,
    filters: StudentReportFilters,
  ): Promise<ReportData> {
    switch (slug) {
      case "by-class":
      case "by-section":
        return this.distribution(schoolId, slug, filters);
      case "parent-list":
        return this.parents(schoolId, filters);
      case "parent-relationships":
        return this.relationships(schoolId, filters);
      default:
        return this.list(schoolId, slug, filters);
    }
  }

  /** The where-clause shared by every list-shaped student report. */
  private studentWhere(
    slug: string,
    filters: StudentReportFilters,
  ): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {};

    // The slug fixes the population; explicit filters narrow within it.
    if (slug === "active") where.status = "ACTIVE";
    else if (slug === "inactive") where.status = "INACTIVE";
    else if (slug === "graduated") where.status = "GRADUATED";
    else if (slug === "male") where.gender = "MALE";
    else if (slug === "female") where.gender = "FEMALE";
    else if (filters.status) where.status = filters.status as Prisma.StudentWhereInput["status"];

    if (filters.gender && !where.gender) {
      where.gender = filters.gender as Prisma.StudentWhereInput["gender"];
    }
    if (filters.className) where.class = { name: filters.className };
    if (filters.section) where.section = { name: filters.section };
    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (slug === "registration" && (filters.dateFrom || filters.dateTo)) {
      where.registrationDate = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
      };
    }
    return where;
  }

  private async list(
    schoolId: string,
    slug: string,
    filters: StudentReportFilters,
  ): Promise<ReportData> {
    const students = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findMany({
        where: this.studentWhere(slug, filters),
        orderBy:
          slug === "registration"
            ? [{ registrationDate: "desc" }]
            : [{ class: { name: "asc" } }, { code: "asc" }],
        select: {
          code: true,
          fullName: true,
          gender: true,
          phone: true,
          status: true,
          registrationDate: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
          parent: { select: { name: true, phone: true } },
        },
      }),
    );

    const columns = [
      { key: "code", label: "Student ID", mono: true as const },
      { key: "name", label: "Student" },
      { key: "gender", label: "Gender" },
      { key: "className", label: "Class" },
      { key: "section", label: "Section" },
      { key: "parent", label: "Parent" },
      { key: "parentPhone", label: "Parent Phone" },
      ...(slug === "registration"
        ? [{ key: "registered", label: "Registered" }]
        : []),
      ...(slug === "list" ? [{ key: "status", label: "Status" }] : []),
    ];

    return {
      columns,
      rows: students.map((s) => ({
        code: s.code,
        name: s.fullName,
        gender: s.gender,
        className: s.class?.name ?? "",
        section: s.section?.name ?? "",
        parent: s.parent?.name ?? "",
        parentPhone: s.parent?.phone ?? s.phone ?? "",
        registered: s.registrationDate.toISOString().slice(0, 10),
        status: s.status,
      })),
      summary: [{ label: "Students", value: String(students.length) }],
    };
  }

  private async distribution(
    schoolId: string,
    slug: string,
    filters: StudentReportFilters,
  ): Promise<ReportData> {
    const students = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findMany({
        where: this.studentWhere("", filters),
        select: {
          gender: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      }),
    );

    const groups = new Map<string, { total: number; male: number; female: number }>();
    for (const s of students) {
      const key =
        slug === "by-class"
          ? (s.class?.name ?? "—")
          : `${s.class?.name ?? "—"} ${s.section?.name ?? ""}`.trim();
      const g = groups.get(key) ?? { total: 0, male: 0, female: 0 };
      g.total += 1;
      if (s.gender === "MALE") g.male += 1;
      else if (s.gender === "FEMALE") g.female += 1;
      groups.set(key, g);
    }

    return {
      columns: [
        { key: "group", label: slug === "by-class" ? "Class" : "Section" },
        { key: "male", label: "Male", align: "right" as const },
        { key: "female", label: "Female", align: "right" as const },
        { key: "total", label: "Total", align: "right" as const },
      ],
      rows: [...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([group, g]) => ({
          group,
          male: g.male,
          female: g.female,
          total: g.total,
        })),
      summary: [
        { label: "Groups", value: String(groups.size) },
        { label: "Students", value: String(students.length) },
      ],
    };
  }

  private async parents(
    schoolId: string,
    filters: StudentReportFilters,
  ): Promise<ReportData> {
    const parents = await this.prisma.forTenant(schoolId, (tx) =>
      tx.parent.findMany({
        where: filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { phone: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {},
        orderBy: { name: "asc" },
        select: {
          code: true,
          name: true,
          phone: true,
          email: true,
          _count: { select: { students: true } },
        },
      }),
    );

    return {
      columns: [
        { key: "code", label: "Parent ID", mono: true },
        { key: "name", label: "Parent" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "children", label: "Children", align: "right" },
      ],
      rows: parents.map((p) => ({
        code: p.code,
        name: p.name,
        phone: p.phone,
        email: p.email ?? "",
        children: p._count.students,
      })),
      summary: [{ label: "Parents", value: String(parents.length) }],
    };
  }

  private async relationships(
    schoolId: string,
    filters: StudentReportFilters,
  ): Promise<ReportData> {
    const students = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findMany({
        where: {
          status: "ACTIVE",
          ...(filters.className ? { class: { name: filters.className } } : {}),
        },
        orderBy: [{ class: { name: "asc" } }, { code: "asc" }],
        select: {
          code: true,
          fullName: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
          parent: { select: { name: true, phone: true } },
        },
      }),
    );

    return {
      columns: [
        { key: "code", label: "Student ID", mono: true },
        { key: "name", label: "Student" },
        { key: "className", label: "Class" },
        { key: "parent", label: "Parent" },
        { key: "phone", label: "Parent Phone" },
      ],
      rows: students.map((s) => ({
        code: s.code,
        name: s.fullName,
        className: `${s.class?.name ?? ""} ${s.section?.name ?? ""}`.trim(),
        parent: s.parent?.name ?? "",
        phone: s.parent?.phone ?? "",
      })),
      summary: [{ label: "Students", value: String(students.length) }],
    };
  }
}
