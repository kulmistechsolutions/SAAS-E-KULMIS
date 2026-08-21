import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportData } from "./fee-reports.service";

export interface AttendanceReportFilters {
  academicYear?: string;
  date?: string;
  month?: string;
  className?: string;
  section?: string;
  status?: string;
  /** Teacher-attendance shift enum (MORNING/AFTERNOON) — see teacherDaily/teacherMonthly. */
  shift?: string;
  /** Student-attendance shift id (AttendanceShift.id) — schools can define any number of named shifts. */
  shiftId?: string;
  search?: string;
}

function monthRange(value?: string): { gte: Date; lt: Date } | null {
  const m = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(month === 12 ? year + 1 : year, month % 12, 1)),
  };
}

function dateOnly(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function pct(present: number, total: number): string {
  return total > 0 ? `${((present / total) * 100).toFixed(1)}%` : "—";
}

/**
 * Student attendance reports, computed straight from student_attendance.
 *
 * Previously these were built in the browser by fetching one day's roster at
 * a time (fetchStudentRecordsForDate) — correct for a single day, but the
 * Monthly/Class/Section/History reports never actually used their `month`
 * filter, so selecting a month silently fell back to "today" every time,
 * making the whole category look broken. This queries the real date range
 * server-side instead, and treats section purely as an optional narrowing
 * filter — a class with no sections at all must still report normally.
 */
@Injectable()
export class AttendanceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    schoolId: string,
    slug: string,
    filters: AttendanceReportFilters,
  ): Promise<ReportData> {
    switch (slug) {
      case "student-monthly":
        return this.monthly(schoolId, filters);
      case "student-class":
        return this.byGroup(schoolId, filters, "class");
      case "student-section":
        return this.byGroup(schoolId, filters, "section");
      case "student-history":
        return this.history(schoolId, filters);
      case "teacher-daily":
        return this.teacherDaily(schoolId, filters);
      case "teacher-monthly":
        return this.teacherMonthly(schoolId, filters, "list");
      case "teacher-shift":
        return this.teacherMonthly(schoolId, filters, "byShift");
      case "student-daily":
      default:
        return this.daily(schoolId, filters);
    }
  }

  private async resolveClassId(
    tx: Parameters<Parameters<PrismaService["forTenant"]>[1]>[0],
    schoolId: string,
    className?: string,
    academicYear?: string,
  ): Promise<string | undefined> {
    if (!className) return undefined;
    const year = academicYear
      ? await tx.academicYear.findFirst({ where: { schoolId, name: academicYear }, select: { id: true } })
      : await tx.academicYear.findFirst({ where: { schoolId, isActive: true }, select: { id: true } });
    if (!year) return undefined;
    const cls = await tx.class.findFirst({
      where: { schoolId, academicYearId: year.id, name: className },
      select: { id: true },
    });
    return cls?.id;
  }

  private async resolveSectionId(
    tx: Parameters<Parameters<PrismaService["forTenant"]>[1]>[0],
    schoolId: string,
    classId: string | undefined,
    section?: string,
  ): Promise<string | undefined> {
    if (!section || !classId) return undefined;
    const sec = await tx.section.findFirst({
      where: { schoolId, classId, name: section },
      select: { id: true },
    });
    return sec?.id;
  }

  private async daily(schoolId: string, filters: AttendanceReportFilters): Promise<ReportData> {
    const date = dateOnly(filters.date) ?? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    return this.prisma.forTenant(schoolId, async (tx) => {
      const classId = await this.resolveClassId(tx, schoolId, filters.className, filters.academicYear);
      const sectionId = await this.resolveSectionId(tx, schoolId, classId, filters.section);
      if (filters.className && !classId) {
        return { columns: [], rows: [], summary: [{ label: "Records", value: "0" }] };
      }

      const rows = await tx.studentAttendance.findMany({
        where: {
          date,
          ...(classId ? { classId } : {}),
          ...(sectionId ? { sectionId } : {}),
          ...(filters.status ? { status: filters.status as never } : {}),
          ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
        },
        include: {
          student: { select: { code: true, fullName: true } },
          shift: { select: { name: true } },
        },
        orderBy: [{ createdAt: "asc" }],
      });
      // classId/sectionId on the row are historical (as marked), so class/section
      // names are looked up once rather than per-row.
      const classIds = [...new Set(rows.map((r) => r.classId))];
      const sectionIds = [...new Set(rows.map((r) => r.sectionId).filter((v): v is string => !!v))];
      const [classes, sections] = await Promise.all([
        classIds.length ? tx.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }) : [],
        sectionIds.length ? tx.section.findMany({ where: { id: { in: sectionIds } }, select: { id: true, name: true } }) : [],
      ]);
      const classById = new Map(classes.map((c) => [c.id, c.name]));
      const sectionById = new Map(sections.map((s) => [s.id, s.name]));

      const q = filters.search?.trim().toLowerCase();
      const filtered = q
        ? rows.filter(
            (r) =>
              r.student.fullName.toLowerCase().includes(q) ||
              r.student.code.toLowerCase().includes(q),
          )
        : rows;

      const present = filtered.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;

      return {
        columns: [
          { key: "student", label: "Student" },
          { key: "code", label: "ID", mono: true },
          { key: "className", label: "Class" },
          { key: "section", label: "Section" },
          { key: "shift", label: "Shift" },
          { key: "date", label: "Date" },
          { key: "status", label: "Status" },
        ],
        rows: filtered.map((r) => ({
          student: r.student.fullName,
          code: r.student.code,
          className: classById.get(r.classId) ?? "—",
          section: r.sectionId ? (sectionById.get(r.sectionId) ?? "—") : "—",
          shift: r.shift?.name ?? "—",
          date: r.date.toISOString().slice(0, 10),
          status: r.status,
        })),
        summary: [
          { label: "Records", value: String(filtered.length) },
          { label: "Present", value: String(present) },
          { label: "Absent", value: String(filtered.filter((r) => r.status === "ABSENT").length) },
          { label: "Rate", value: pct(present, filtered.length) },
        ],
      };
    });
  }

  private async monthly(schoolId: string, filters: AttendanceReportFilters): Promise<ReportData> {
    const range = monthRange(filters.month);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const classId = await this.resolveClassId(tx, schoolId, filters.className, filters.academicYear);
      const sectionId = await this.resolveSectionId(tx, schoolId, classId, filters.section);
      if (filters.className && !classId) {
        return { columns: [], rows: [], summary: [{ label: "Students", value: "0" }] };
      }

      const rows = await tx.studentAttendance.findMany({
        where: {
          ...(range ? { date: { gte: range.gte, lt: range.lt } } : {}),
          ...(classId ? { classId } : {}),
          ...(sectionId ? { sectionId } : {}),
        },
        select: { studentId: true, status: true },
      });

      const studentIds = [...new Set(rows.map((r) => r.studentId))];
      const students = studentIds.length
        ? await tx.student.findMany({
            where: { id: { in: studentIds } },
            select: {
              id: true,
              code: true,
              fullName: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          })
        : [];
      const studentById = new Map(students.map((s) => [s.id, s]));

      const byStudent = new Map<string, { present: number; total: number }>();
      for (const r of rows) {
        const cur = byStudent.get(r.studentId) ?? { present: 0, total: 0 };
        cur.total += 1;
        if (r.status === "PRESENT" || r.status === "LATE") cur.present += 1;
        byStudent.set(r.studentId, cur);
      }

      const q = filters.search?.trim().toLowerCase();
      const entries = [...byStudent.entries()].filter(([id]) => {
        if (!q) return true;
        const s = studentById.get(id);
        return s ? s.fullName.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) : false;
      });

      const totalRate =
        entries.length > 0
          ? entries.reduce((sum, [, v]) => sum + v.present / v.total, 0) / entries.length
          : 0;

      return {
        columns: [
          { key: "student", label: "Student" },
          { key: "code", label: "ID", mono: true },
          { key: "className", label: "Class" },
          { key: "section", label: "Section" },
          { key: "present", label: "Present Days", align: "right" },
          { key: "total", label: "Total Days", align: "right" },
          { key: "rate", label: "Attendance %", align: "right" },
        ],
        rows: entries.map(([id, v]) => {
          const s = studentById.get(id);
          return {
            student: s?.fullName ?? "—",
            code: s?.code ?? "—",
            className: s?.class.name ?? "—",
            section: s?.section?.name ?? "—",
            present: v.present,
            total: v.total,
            rate: pct(v.present, v.total),
          };
        }),
        summary: [
          { label: "Students", value: String(entries.length) },
          { label: "Average Attendance", value: `${(totalRate * 100).toFixed(1)}%` },
        ],
      };
    });
  }

  private async byGroup(
    schoolId: string,
    filters: AttendanceReportFilters,
    mode: "class" | "section",
  ): Promise<ReportData> {
    const range = monthRange(filters.month);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const classId = await this.resolveClassId(tx, schoolId, filters.className, filters.academicYear);
      if (filters.className && !classId) {
        return { columns: [], rows: [], summary: [{ label: "Groups", value: "0" }] };
      }

      const rows = await tx.studentAttendance.findMany({
        where: {
          ...(range ? { date: { gte: range.gte, lt: range.lt } } : {}),
          ...(classId ? { classId } : {}),
        },
        select: { classId: true, sectionId: true, status: true },
      });

      const classIds = [...new Set(rows.map((r) => r.classId))];
      const sectionIds = [...new Set(rows.map((r) => r.sectionId).filter((v): v is string => !!v))];
      const [classes, sections] = await Promise.all([
        classIds.length ? tx.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }) : [],
        sectionIds.length ? tx.section.findMany({ where: { id: { in: sectionIds } }, select: { id: true, name: true } }) : [],
      ]);
      const classById = new Map(classes.map((c) => [c.id, c.name]));
      const sectionById = new Map(sections.map((s) => [s.id, s.name]));

      const byGroup = new Map<string, { present: number; total: number }>();
      for (const r of rows) {
        const key =
          mode === "section"
            ? `${classById.get(r.classId) ?? "—"} — ${r.sectionId ? (sectionById.get(r.sectionId) ?? "—") : "—"}`
            : (classById.get(r.classId) ?? "—");
        const cur = byGroup.get(key) ?? { present: 0, total: 0 };
        cur.total += 1;
        if (r.status === "PRESENT" || r.status === "LATE") cur.present += 1;
        byGroup.set(key, cur);
      }

      return {
        columns: [
          { key: "group", label: mode === "section" ? "Class / Section" : "Class" },
          { key: "rate", label: "Attendance %", align: "right" },
          { key: "present", label: "Present", align: "right" },
          { key: "total", label: "Records", align: "right" },
        ],
        rows: [...byGroup.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([group, v]) => ({
            group,
            rate: pct(v.present, v.total),
            present: v.present,
            total: v.total,
          })),
        summary: [{ label: "Groups", value: String(byGroup.size) }],
      };
    });
  }

  private async history(schoolId: string, filters: AttendanceReportFilters): Promise<ReportData> {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const classId = await this.resolveClassId(tx, schoolId, filters.className, filters.academicYear);
      const sectionId = await this.resolveSectionId(tx, schoolId, classId, filters.section);
      if (filters.className && !classId) {
        return { columns: [], rows: [], summary: [{ label: "Records", value: "0" }] };
      }

      const rows = await tx.studentAttendance.findMany({
        where: {
          ...(classId ? { classId } : {}),
          ...(sectionId ? { sectionId } : {}),
        },
        include: { student: { select: { code: true, fullName: true } } },
        orderBy: [{ date: "desc" }],
        take: 2000,
      });

      const classIds = [...new Set(rows.map((r) => r.classId))];
      const sectionIds = [...new Set(rows.map((r) => r.sectionId).filter((v): v is string => !!v))];
      const [classes, sections] = await Promise.all([
        classIds.length ? tx.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }) : [],
        sectionIds.length ? tx.section.findMany({ where: { id: { in: sectionIds } }, select: { id: true, name: true } }) : [],
      ]);
      const classById = new Map(classes.map((c) => [c.id, c.name]));
      const sectionById = new Map(sections.map((s) => [s.id, s.name]));

      const q = filters.search?.trim().toLowerCase();
      const filtered = q
        ? rows.filter(
            (r) =>
              r.student.fullName.toLowerCase().includes(q) ||
              r.student.code.toLowerCase().includes(q),
          )
        : rows;

      return {
        columns: [
          { key: "student", label: "Student" },
          { key: "code", label: "ID", mono: true },
          { key: "className", label: "Class" },
          { key: "section", label: "Section" },
          { key: "date", label: "Date" },
          { key: "status", label: "Status" },
        ],
        rows: filtered.map((r) => ({
          student: r.student.fullName,
          code: r.student.code,
          className: classById.get(r.classId) ?? "—",
          section: r.sectionId ? (sectionById.get(r.sectionId) ?? "—") : "—",
          date: r.date.toISOString().slice(0, 10),
          status: r.status,
        })),
        summary: [
          { label: "Records", value: String(filtered.length) },
          {
            label: "Present",
            value: String(filtered.filter((r) => r.status === "PRESENT").length),
          },
        ],
      };
    });
  }

  private async teacherDaily(schoolId: string, filters: AttendanceReportFilters): Promise<ReportData> {
    const date = dateOnly(filters.date) ?? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    return this.prisma.forTenant(schoolId, async (tx) => {
      const rows = await tx.teacherAttendance.findMany({
        where: {
          date,
          ...(filters.status ? { status: filters.status as never } : {}),
          ...(filters.shift ? { shiftId: filters.shift } : {}),
        },
        include: {
          teacher: { select: { code: true, fullName: true } },
          shift: { select: { name: true } },
        },
        orderBy: [{ createdAt: "asc" }],
      });
      const q = filters.search?.trim().toLowerCase();
      const filtered = q
        ? rows.filter(
            (r) =>
              r.teacher.fullName.toLowerCase().includes(q) ||
              r.teacher.code.toLowerCase().includes(q),
          )
        : rows;
      return {
        columns: [
          { key: "teacher", label: "Teacher" },
          { key: "code", label: "ID", mono: true },
          { key: "date", label: "Date" },
          { key: "shift", label: "Shift" },
          { key: "status", label: "Status" },
        ],
        rows: filtered.map((r) => ({
          teacher: r.teacher.fullName,
          code: r.teacher.code,
          date: r.date.toISOString().slice(0, 10),
          shift: r.shift?.name ?? "—",
          status: r.status,
        })),
        summary: [
          { label: "Records", value: String(filtered.length) },
          { label: "Present", value: String(filtered.filter((r) => r.status === "PRESENT").length) },
        ],
      };
    });
  }

  private async teacherMonthly(
    schoolId: string,
    filters: AttendanceReportFilters,
    mode: "list" | "byShift",
  ): Promise<ReportData> {
    const range = monthRange(filters.month);
    const shift = filters.shift;
    return this.prisma.forTenant(schoolId, async (tx) => {
      const rows = await tx.teacherAttendance.findMany({
        where: {
          ...(range ? { date: { gte: range.gte, lt: range.lt } } : {}),
          ...(shift ? { shiftId: shift } : {}),
        },
        select: {
          teacherId: true,
          status: true,
          shift: { select: { name: true } },
        },
      });

      if (mode === "byShift") {
        const byShift = new Map<string, { present: number; total: number }>();
        for (const r of rows) {
          const label = r.shift?.name ?? "—";
          const cur = byShift.get(label) ?? { present: 0, total: 0 };
          cur.total += 1;
          if (r.status === "PRESENT" || r.status === "LATE") cur.present += 1;
          byShift.set(label, cur);
        }
        return {
          columns: [
            { key: "group", label: "Shift" },
            { key: "rate", label: "Attendance %", align: "right" },
            { key: "present", label: "Present", align: "right" },
            { key: "total", label: "Records", align: "right" },
          ],
          rows: [...byShift.entries()].map(([group, v]) => ({
            group,
            rate: pct(v.present, v.total),
            present: v.present,
            total: v.total,
          })),
          summary: [{ label: "Shifts", value: String(byShift.size) }],
        };
      }

      const teacherIds = [...new Set(rows.map((r) => r.teacherId))];
      const teachers = teacherIds.length
        ? await tx.teacher.findMany({ where: { id: { in: teacherIds } }, select: { id: true, code: true, fullName: true } })
        : [];
      const teacherById = new Map(teachers.map((t) => [t.id, t]));

      const byTeacher = new Map<string, { present: number; total: number }>();
      for (const r of rows) {
        const cur = byTeacher.get(r.teacherId) ?? { present: 0, total: 0 };
        cur.total += 1;
        if (r.status === "PRESENT" || r.status === "LATE") cur.present += 1;
        byTeacher.set(r.teacherId, cur);
      }

      const q = filters.search?.trim().toLowerCase();
      const entries = [...byTeacher.entries()].filter(([id]) => {
        if (!q) return true;
        const t = teacherById.get(id);
        return t ? t.fullName.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) : false;
      });

      return {
        columns: [
          { key: "teacher", label: "Teacher" },
          { key: "code", label: "ID", mono: true },
          { key: "present", label: "Present Days", align: "right" },
          { key: "total", label: "Total Days", align: "right" },
          { key: "rate", label: "Attendance %", align: "right" },
        ],
        rows: entries.map(([id, v]) => {
          const t = teacherById.get(id);
          return {
            teacher: t?.fullName ?? "—",
            code: t?.code ?? "—",
            present: v.present,
            total: v.total,
            rate: pct(v.present, v.total),
          };
        }),
        summary: [{ label: "Teachers", value: String(entries.length) }],
      };
    });
  }
}
