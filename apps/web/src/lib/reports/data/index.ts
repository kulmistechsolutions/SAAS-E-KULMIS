import { api } from "@/lib/api";
import { filterTeacherRecords } from "@/lib/attendance/store";
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

/**
 * Both student and teacher attendance reports are computed server-side —
 * this used to fetch one day's roster at a time from the browser's
 * attendance store (fetchStudentRecordsForDate / fetchTeacherRecordsForDate),
 * which only ever understood a single `date`, not a `month` range. Every
 * report in this category other than "Daily" passes `month`, not `date`, so
 * they were all silently falling back to "today" regardless of which month
 * was actually selected — Section was never required to reach that bug, it
 * just made the empty-looking result more confusing to explain.
 */
async function fetchAttendanceReportAsync(
  slug: string,
  filters: ReportFilters,
): Promise<ReportData> {
  const year = yearOf(filters);
  const params = new URLSearchParams();
  params.set("academicYear", year);
  for (const key of ["date", "month", "className", "section", "status", "shift", "search"] as const) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  try {
    return await api<ReportData>(
      `/reports/attendance-reports/${encodeURIComponent(slug)}?${params.toString()}`,
    );
  } catch {
    return emptyReport("Could not load attendance data.");
  }
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
