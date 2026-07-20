import { api } from "@/lib/api";
import { filterStudentRecords, filterTeacherRecords } from "@/lib/attendance/store";
import type { ReportData, ReportFilters } from "../types";
import { yearOf } from "./utils";

export async function fetchReportAsync(
  category: string,
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  if (category === "attendance") {
    return fetchAttendanceReportAsync(slug, filters);
  }
  if (category === "teachers" && slug === "attendance") {
    return fetchTeacherAttendanceReportAsync(filters);
  }
  if (category === "teachers") {
    return fetchTeacherReportAsync(slug, filters);
  }
  if (category === "fees") {
    return fetchFeeReportAsync(slug, filters);
  }
  if (category === "students") {
    return fetchStudentReportAsync(slug, filters);
  }
  if (category === "examinations") {
    return fetchExamReportAsync(slug, filters);
  }
  if (category === "promotions") {
    return fetchPromotionReportAsync(slug, filters);
  }
  if (category === "salary") {
    return fetchSalaryReportAsync(slug, filters);
  }
  if (category === "expenses") {
    return fetchExpenseReportAsync(slug, filters);
  }
  if (category === "financial") {
    return fetchFinancialReportAsync(slug, filters);
  }
  if (category === "quiz") {
    return fetchQuizReportAsync(slug, filters);
  }
  return fetchReport(category, slug, filters);
}

export function fetchReport(
  category: string,
  slug: string,
  filters: ReportFilters,
): ReportData {
  void filters;
  switch (category) {
    case "students":
      return emptyReport("Loading student data…");
    case "teachers":
      return emptyReport("Loading teacher data…");
    case "attendance":
      return emptyReport("Loading attendance data…");
    case "fees":
      return emptyReport("Loading fee data…");
    case "examinations":
      return emptyReport("Loading exam data…");
    case "promotions":
      return emptyReport("Loading promotion data…");
    case "salary":
      return emptyReport("Loading salary data…");
    case "expenses":
      return emptyReport("Loading expense data…");
    case "financial":
      return emptyReport("Loading financial data…");
    case "quiz":
      return emptyReport("Loading quiz data…");
    default:
      return emptyReport("Report not found");
  }
}

function emptyReport(msg: string): ReportData {
  return {
    columns: [{ key: "message", label: "Message" }],
    rows: [{ message: msg }],
    summary: [{ label: "Total", value: "0" }],
  };
}

async function fetchTeacherAttendanceReportAsync(
  filters: ReportFilters,
): Promise<ReportData> {
  const records = await filterTeacherRecords({
    date: filters.date,
    shift: filters.shift as "MORNING" | "AFTERNOON" | undefined,
    status: filters.status as never,
    search: filters.search,
  });
  return {
    columns: [
      { key: "teacher", label: "Teacher" },
      { key: "date", label: "Date" },
      { key: "shift", label: "Shift" },
      { key: "status", label: "Status" },
    ],
    rows: records.map((r) => ({
      teacher: r.teacher.fullName,
      date: r.date,
      shift: r.shift,
      status: r.status,
    })),
    summary: [{ label: "Records", value: String(records.length) }],
  };
}

async function fetchAttendanceReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const year = yearOf(filters);

  if (slug.startsWith("student")) {
    if (slug === "student-class" || slug === "student-section") {
      const records = await filterStudentRecords({
        academicYear: year,
        date: filters.date,
        className: filters.className,
        section: filters.section,
      });
      const map = new Map<string, { present: number; total: number }>();
      for (const r of records) {
        const key = slug === "student-section"
          ? `${r.className} — ${r.section ?? "—"}`
          : r.className;
        const cur = map.get(key) ?? { present: 0, total: 0 };
        cur.total += 1;
        if (r.status === "PRESENT" || r.status === "LATE") cur.present += 1;
        map.set(key, cur);
      }
      return {
        columns: [
          { key: "group", label: slug === "student-section" ? "Class / Section" : "Class" },
          { key: "rate", label: "Attendance %", align: "right" },
          { key: "present", label: "Present", align: "right" },
          { key: "total", label: "Records", align: "right" },
        ],
        rows: [...map.entries()].map(([group, v]) => ({
          group,
          rate: `${((v.present / v.total) * 100).toFixed(1)}%`,
          present: v.present,
          total: v.total,
        })),
        summary: [{ label: "Groups", value: String(map.size) }],
      };
    }

    const records = await filterStudentRecords({
      academicYear: year,
      date: filters.date,
      className: filters.className,
      section: filters.section,
      status: filters.status as never,
      search: filters.search,
    });
    return {
      columns: [
        { key: "student", label: "Student" },
        { key: "code", label: "ID", mono: true },
        { key: "className", label: "Class" },
        { key: "section", label: "Section" },
        { key: "date", label: "Date" },
        { key: "status", label: "Status" },
      ],
      rows: records.map((r) => ({
        student: r.student.fullName,
        code: r.student.code,
        className: r.className,
        section: r.section ?? "—",
        date: r.date,
        status: r.status,
      })),
      summary: [
        { label: "Records", value: String(records.length) },
        {
          label: "Present",
          value: String(records.filter((r) => r.status === "PRESENT").length),
        },
      ],
    };
  }

  return fetchTeacherAttendanceReportAsync(filters);
}

/**
 * Fee reports are computed by the API from the database.
 *
 * They used to be built here from the browser's fee store, which only ever held
 * what the fee PAGES had loaded — so opening a report directly showed an empty
 * or half-complete list. A report has to be a question asked of the school's
 * real data, not of one browser tab's memory.
 */
/**
 * Student and parent reports, from the API rather than the browser'''s student
 * store which only ever held the pages someone had scrolled through.
 */
/** Teacher list, salary and assignment reports, from the API. */
async function fetchTeacherReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const params = new URLSearchParams();
  for (const key of ["shift", "status", "className", "section", "subject", "search"] as const) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  const query = params.toString();
  try {
    return await api<ReportData>(
      `/reports/teacher-reports/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
    );
  } catch {
    return emptyReport("Could not load teacher data.");
  }
}

async function fetchStudentReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const params = new URLSearchParams();
  for (const key of ["className", "section", "gender", "status", "dateFrom", "dateTo", "search"] as const) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  const query = params.toString();
  try {
    return await api<ReportData>(
      `/reports/student-reports/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
    );
  } catch {
    return emptyReport("Could not load student data.");
  }
}

async function fetchFeeReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const params = new URLSearchParams();
  for (const key of ["className", "section", "month", "dateFrom", "dateTo", "search"] as const) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  const query = params.toString();
  try {
    return await api<ReportData>(
      `/reports/fees/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
    );
  } catch {
    return emptyReport("Could not load fee data.");
  }
}

/**
 * Examination reports, from the API. They reuse the same results engine behind
 * the on-screen results and the results PDF, so a report can never disagree
 * with what a teacher or parent already sees.
 */
async function fetchExamReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const params = new URLSearchParams();
  for (const key of ["examId", "className", "section", "subject", "term", "search"] as const) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  const query = params.toString();
  try {
    return await api<ReportData>(
      `/reports/exam-reports/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
    );
  } catch {
    return emptyReport("Could not load exam data.");
  }
}


/** Promotion and graduation reports, from the API. */
async function fetchPromotionReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const params = new URLSearchParams();
  for (const key of ["className", "section", "search"] as const) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  const query = params.toString();
  try {
    return await api<ReportData>(
      `/reports/promotion-reports/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
    );
  } catch {
    return emptyReport("Could not load promotion data.");
  }
}

/** Staff salary reports, from the API. */
async function fetchSalaryReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const params = new URLSearchParams();
  for (const key of ["month", "shift", "status"] as const) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  const query = params.toString();
  try {
    return await api<ReportData>(
      `/reports/salary-reports/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
    );
  } catch {
    return emptyReport("Could not load salary data.");
  }
}

/** Operational expense reports, from the API. */
async function fetchExpenseReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const params = new URLSearchParams();
  for (const key of ["dateFrom", "dateTo", "month", "category"] as const) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  const query = params.toString();
  try {
    return await api<ReportData>(
      `/reports/expense-reports/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
    );
  } catch {
    return emptyReport("Could not load expense data.");
  }
}

/** Income vs. expenses vs. salaries, from the API. */
async function fetchFinancialReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const params = new URLSearchParams();
  if (filters.month) params.set("month", String(filters.month));
  const query = params.toString();
  try {
    return await api<ReportData>(
      `/reports/financial-reports/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
    );
  } catch {
    return emptyReport("Could not load financial data.");
  }
}

/** Quiz performance and activity reports, from the API. */
async function fetchQuizReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const params = new URLSearchParams();
  for (const key of ["className", "section"] as const) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  const query = params.toString();
  try {
    return await api<ReportData>(
      `/reports/quiz-reports/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
    );
  } catch {
    return emptyReport("Could not load quiz data.");
  }
}
