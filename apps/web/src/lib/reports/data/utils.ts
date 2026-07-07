import { activeAcademicYear } from "@/lib/academics/store";
import { getState as getStudentsState, withParents } from "@/lib/students/store";
import type { StudentStatus } from "@/lib/students/types";
import type { ReportData, ReportFilters } from "../types";

export function yearOf(filters: ReportFilters): string {
  return filters.academicYear || activeAcademicYear();
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function money(n: number): string {
  return `$${n.toLocaleString()}`;
}

export function filterStudents(filters: ReportFilters, status?: StudentStatus | StudentStatus[]) {
  const statuses = status ? (Array.isArray(status) ? status : [status]) : null;
  const q = filters.search?.trim().toLowerCase() ?? "";
  const year = yearOf(filters);

  return withParents(getStudentsState()).filter((s) => {
    if (statuses && !statuses.includes(s.status)) return false;
    if (filters.academicYear && s.academicYear !== filters.academicYear) return false;
    if (!filters.academicYear && s.academicYear !== year && statuses?.includes("ACTIVE")) {
      /* allow graduated without year lock */
    }
    if (filters.className && s.className !== filters.className) return false;
    if (filters.section && (s.section ?? "") !== filters.section) return false;
    if (filters.gender && s.gender !== filters.gender) return false;
    if (filters.status && s.status !== filters.status) return false;
    if (filters.dateFrom && s.registrationDate < filters.dateFrom) return false;
    if (filters.dateTo && s.registrationDate > filters.dateTo) return false;
    if (q) {
      const hay = `${s.code} ${s.fullName} ${s.parent.name} ${s.parent.phone}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function studentListData(
  filters: ReportFilters,
  status?: StudentStatus | StudentStatus[],
): ReportData {
  const rows = filterStudents(filters, status).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
  return {
    columns: [
      { key: "code", label: "Student ID", mono: true },
      { key: "name", label: "Name" },
      { key: "gender", label: "Gender" },
      { key: "className", label: "Class" },
      { key: "section", label: "Section" },
      { key: "parent", label: "Parent" },
      { key: "phone", label: "Phone" },
      { key: "status", label: "Status" },
    ],
    rows: rows.map((s) => ({
      code: s.code,
      name: s.fullName,
      gender: s.gender.charAt(0) + s.gender.slice(1).toLowerCase(),
      className: s.className,
      section: s.section ? `Section ${s.section}` : "—",
      parent: s.parent.name,
      phone: s.parent.phone,
      status: s.status.charAt(0) + s.status.slice(1).toLowerCase(),
    })),
    summary: [
      { label: "Total Records", value: String(rows.length) },
      {
        label: "Male",
        value: String(rows.filter((s) => s.gender === "MALE").length),
      },
      {
        label: "Female",
        value: String(rows.filter((s) => s.gender === "FEMALE").length),
      },
    ],
  };
}
