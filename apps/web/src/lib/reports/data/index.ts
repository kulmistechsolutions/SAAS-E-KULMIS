import { api } from "@/lib/api";
import { filterStudentRecords, filterTeacherRecords } from "@/lib/attendance/store";
import { dashboardSummary as feeDashboard } from "@/lib/fees/store";
import {
  graduatedStudents,
  promotionHistory,
} from "@/lib/promotions/store";
import {
  payrollRows,
  totalSalariesForMonth,
} from "@/lib/salary/store";
import { monthLabel as salaryMonthLabel } from "@/lib/salary/format";
import {
  listQuizzes,
  getQuizState,
} from "@/lib/quiz/store";
import { incomeVsExpense } from "@/lib/dashboard-data";
import type { ReportData, ReportFilters } from "../types";
import { money, shortDate, yearOf } from "./utils";

import {
  expensesByCategory,
  getExpensesState,
  listExpenses,
  totalExpenses,
} from "@/lib/expenses/store";

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
  return fetchReport(category, slug, filters);
}

export function fetchReport(
  category: string,
  slug: string,
  filters: ReportFilters,
): ReportData {
  switch (category) {
    case "students":
      return emptyReport("Loading student data…");
    case "teachers":
      return emptyReport("Loading teacher data…");
    case "attendance":
      return emptyReport("Loading attendance data…");
    case "fees":
      // Fee reports come from the API; this branch is only reached before the
      // first response lands.
      return emptyReport("Loading fee data…");
    case "examinations":
      return emptyReport("Loading exam data…");
    case "promotions":
      return fetchPromotionReport(slug, filters);
    case "salary":
      return fetchSalaryReport(slug, filters);
    case "expenses":
      return fetchExpenseReport(slug, filters);
    case "financial":
      return fetchFinancialReport(slug, filters);
    case "quiz":
      return fetchQuizReport(slug, filters);
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

function fetchPromotionReport(slug: string, filters: ReportFilters): ReportData {
  const typeMap: Record<string, "INDIVIDUAL" | "CLASS" | "SCHOOL_WIDE" | undefined> = {
    individual: "INDIVIDUAL",
    class: "CLASS",
    "school-wide": "SCHOOL_WIDE",
  };

  if (slug === "graduated") {
    const rows = graduatedStudents({ search: filters.search, academicYear: filters.academicYear });
    return {
      columns: [
        { key: "code", label: "Student ID", mono: true },
        { key: "name", label: "Name" },
        { key: "finalClass", label: "Final Class" },
        { key: "year", label: "Graduation Year" },
        { key: "date", label: "Date" },
      ],
      rows: rows.map((r) => ({
        code: r.studentCode,
        name: r.studentName,
        finalClass: r.finalClass,
        year: r.graduationYear,
        date: shortDate(r.graduationDate),
      })),
      summary: [{ label: "Graduated", value: String(rows.length) }],
    };
  }

  const rows = promotionHistory({
    search: filters.search,
    academicYear: filters.academicYear,
    type: typeMap[slug],
  });

  return {
    columns: [
      { key: "student", label: "Student" },
      { key: "type", label: "Type" },
      { key: "from", label: "From" },
      { key: "to", label: "To" },
      { key: "date", label: "Date" },
    ],
    rows: rows.map((r) => ({
      student: `${r.studentName} (${r.studentCode})`,
      type: r.type,
      from: `${r.fromClass}${r.fromSection ? ` ${r.fromSection}` : ""}`,
      to: r.graduated ? "Graduated" : `${r.toClass}${r.toSection ? ` ${r.toSection}` : ""}`,
      date: shortDate(r.promotedAt),
    })),
    summary: [{ label: "Records", value: String(rows.length) }],
  };
}

function fetchSalaryReport(slug: string, filters: ReportFilters): ReportData {
  const month = filters.month;
  const rows = payrollRows({
    month: month || undefined,
    status:
      slug === "outstanding"
        ? undefined
        : slug === "paid"
          ? "PAID"
          : slug === "pending"
            ? "PENDING"
            : slug === "partial"
              ? "PARTIAL"
              : undefined,
    type: slug === "teacher" ? "TEACHER" : slug === "staff" ? "STAFF" : undefined,
    search: filters.search,
  });

  if (slug === "outstanding" || slug === "pending" || slug === "partial") {
    const filtered = rows.filter((r) =>
      slug === "outstanding"
        ? r.remainingBalance > 0
        : slug === "pending"
          ? r.status === "PENDING"
          : r.status === "PARTIAL",
    );
    const totalOutstanding = filtered.reduce((s, r) => s + r.remainingBalance, 0);
    return {
      columns: [
        { key: "employee", label: "Employee" },
        { key: "position", label: "Position" },
        { key: "amount", label: "Outstanding", align: "right" },
        { key: "month", label: "Month" },
      ],
      rows: filtered.map((r) => ({
        employee: `${r.employeeName} (${r.employeeCode})`,
        position: r.position,
        amount: money(r.remainingBalance),
        month: salaryMonthLabel(r.payrollMonth),
      })),
      summary: [
        { label: "Records", value: String(filtered.length) },
        { label: "Outstanding", value: money(totalOutstanding) },
      ],
    };
  }

  const total = rows.reduce((s, r) => s + r.netSalary, 0);
  const multiplier = slug === "annual" ? 12 : 1;

  return {
    columns: [
      { key: "code", label: "ID", mono: true },
      { key: "name", label: "Employee" },
      { key: "position", label: "Position" },
      { key: "salary", label: slug === "annual" ? "Annual (est.)" : "Net Salary", align: "right" },
      { key: "status", label: "Status" },
    ],
    rows: rows.map((r) => ({
      code: r.employeeCode,
      name: r.employeeName,
      position: r.position,
      salary: money(r.netSalary * multiplier),
      status: r.status,
    })),
    summary: [
      { label: "Employees", value: String(rows.length) },
      { label: "Total", value: money(total * multiplier) },
    ],
  };
}

function fetchExpenseReport(slug: string, filters: ReportFilters): ReportData {
  const year = filters.academicYear || getExpensesState().academicYear;
  const month = filters.month;

  if (slug === "categories") {
    const breakdown = expensesByCategory(month, year);
    const total = breakdown.reduce((s, b) => s + b.amount, 0);
    return {
      columns: [
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "percent", label: "Share", align: "right" },
      ],
      rows: breakdown.map((b) => ({
        category: b.category,
        amount: money(b.amount),
        percent: total > 0 ? `${((b.amount / total) * 100).toFixed(1)}%` : "0%",
      })),
      summary: [{ label: "Total Expenses", value: money(total) }],
    };
  }

  if (slug === "summary") {
    const total = totalExpenses({ academicYear: year, month, dateFrom: filters.dateFrom, dateTo: filters.dateTo });
    const breakdown = expensesByCategory(month, year);
    return {
      columns: [
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount", align: "right" },
      ],
      rows: breakdown.map((b) => ({
        category: b.category,
        amount: money(b.amount),
      })),
      summary: [{ label: "Total Expenses", value: money(total) }],
    };
  }

  const rows = listExpenses({
    academicYear: year,
    categoryId: filters.category
      ? getExpensesState().categories.find((c) => c.name === filters.category)?.id
      : undefined,
    dateFrom: slug === "daily" ? filters.dateFrom ?? filters.date : filters.dateFrom,
    dateTo: slug === "daily" ? filters.dateTo ?? filters.date : filters.dateTo,
    sortKey: "expenseDate",
    sortDir: "desc",
  }).filter((r) => {
    if (!month) return true;
    return r.expenseDate.slice(0, 7) === month.slice(0, 7);
  });

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return {
    columns: [
      { key: "reference", label: "Reference", mono: true },
      { key: "date", label: "Date" },
      { key: "category", label: "Category" },
      { key: "title", label: "Description" },
      { key: "amount", label: "Amount", align: "right" },
    ],
    rows: rows.map((r) => ({
      reference: r.referenceNo,
      date: r.expenseDate,
      category: r.categoryName,
      title: r.title,
      amount: money(r.amount),
    })),
    summary: [{ label: "Total", value: money(total) }],
  };
}

function fetchFinancialReport(slug: string, filters: ReportFilters): ReportData {
  const feeSum = feeDashboard(filters.month);
  const income = feeSum.collectedThisMonth + feeSum.collectedToday;
  const expenses = totalExpenses({ academicYear: filters.academicYear, month: filters.month });
  const salaries = totalSalariesForMonth(filters.month);
  const net = income - expenses - salaries;

  if (slug === "net-income" || slug === "monthly-statement") {
    return {
      columns: [
        { key: "line", label: "Line Item" },
        { key: "amount", label: "Amount", align: "right" },
      ],
      rows: [
        { line: "Fee Collections", amount: money(income) },
        { line: "Expenses", amount: money(-expenses) },
        { line: "Salaries", amount: money(-salaries) },
        { line: "Net Income", amount: money(net) },
      ],
      summary: [
        { label: "Net Income", value: money(net) },
        { label: "Reference", value: incomeVsExpense.netIncome },
      ],
    };
  }

  const map: Record<string, { line: string; amount: number }> = {
    income: { line: "Fee Income", amount: income },
    expenses: { line: "Total Expenses", amount: expenses },
    salary: { line: "Total Salaries", amount: salaries },
  };
  const item = map[slug] ?? map.income;
  return {
    columns: [
      { key: "line", label: "Item" },
      { key: "amount", label: "Amount", align: "right" },
    ],
    rows: [{ line: item.line, amount: money(item.amount) }],
    summary: [{ label: "Total", value: money(item.amount) }],
  };
}

function fetchQuizReport(slug: string, filters: ReportFilters): ReportData {
  const qs = getQuizState();
  const quizList = listQuizzes({
    academicYear: filters.academicYear,
    className: filters.className,
    section: filters.section,
  });

  if (slug === "teacher-activity") {
    const map = new Map<string, { teacher: string; count: number }>();
    for (const q of quizList) {
      const cur = map.get(q.teacherName) ?? { teacher: q.teacherName, count: 0 };
      cur.count += 1;
      map.set(q.teacherName, cur);
    }
    return {
      columns: [
        { key: "teacher", label: "Teacher" },
        { key: "quizzes", label: "Quizzes Created", align: "right" },
      ],
      rows: [...map.values()].map((r) => ({ teacher: r.teacher, quizzes: r.count })),
      summary: [{ label: "Teachers", value: String(map.size) }],
    };
  }

  if (slug === "attempts" || slug === "completion") {
    return {
      columns: [
        { key: "quiz", label: "Quiz" },
        { key: "attempts", label: "Attempts", align: "right" },
        { key: "status", label: "Status" },
      ],
      rows: quizList.map((q) => ({
        quiz: q.title,
        attempts: q.attemptCount,
        status: q.status,
      })),
      summary: [{ label: "Quizzes", value: String(quizList.length) }],
    };
  }

  if (slug === "averages") {
    return {
      columns: [
        { key: "group", label: "Class / Section" },
        { key: "avg", label: "Avg Score %", align: "right" },
      ],
      rows: quizList.map((q) => {
        const attempts = qs.attempts.filter((a) => a.quizId === q.id && a.percentage !== null);
        const avg = attempts.length
          ? attempts.reduce((s, a) => s + (a.percentage ?? 0), 0) / attempts.length
          : 0;
        return {
          group: `${q.className} — ${q.section}`,
          avg: `${avg.toFixed(1)}%`,
        };
      }),
      summary: [{ label: "Groups", value: String(quizList.length) }],
    };
  }

  const attempts = qs.attempts.filter((a) => a.status !== "IN_PROGRESS");
  return {
    columns: [
      { key: "student", label: "Student" },
      { key: "className", label: "Class" },
      { key: "quiz", label: "Quiz" },
      { key: "score", label: "Score", align: "right" },
      { key: "status", label: "Status" },
    ],
    rows: attempts.slice(0, 50).map((a) => {
      const q = quizList.find((x) => x.id === a.quizId);
      return {
        student: a.studentName,
        className: q?.className ?? "—",
        quiz: q?.title ?? "—",
        score: a.percentage !== null ? `${a.percentage}%` : "Pending",
        status: a.result ?? a.status,
      };
    }),
    summary: [
      { label: "Records", value: String(attempts.length) },
      {
        label: "Avg Score",
        value: `${(
          attempts.filter((a) => a.percentage !== null).reduce((s, a) => s + (a.percentage ?? 0), 0) /
            Math.max(1, attempts.filter((a) => a.percentage !== null).length)
        ).toFixed(0)}%`,
      },
    ],
  };
}
