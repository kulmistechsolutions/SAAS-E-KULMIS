import { filterStudentRecords, filterTeacherRecords } from "@/lib/attendance/store";
import { activeAcademicYear } from "@/lib/academics/store";
import {
  getExaminationsState,
  monitoringRows,
  studentFinalResult,
} from "@/lib/examinations/store";
import {
  dashboardSummary as feeDashboard,
  getFeesState,
  listStudentFees,
  outstandingBalance,
  studentAnnualSummary,
  studentCharges,
} from "@/lib/fees/store";
import { monthLabel } from "@/lib/fees/format";
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
import { getState as getStudentsState, listParents } from "@/lib/students/store";
import { getTeachersState, summarize } from "@/lib/teachers/store";
import { incomeVsExpense } from "@/lib/dashboard-data";
import type { ReportData, ReportFilters } from "../types";
import { filterStudents, money, shortDate, studentListData, yearOf } from "./utils";

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
  return fetchReport(category, slug, filters);
}

export function fetchReport(
  category: string,
  slug: string,
  filters: ReportFilters,
): ReportData {
  switch (category) {
    case "students":
      return fetchStudentReport(slug, filters);
    case "teachers":
      return fetchTeacherReport(slug, filters);
    case "attendance":
      return emptyReport("Loading attendance data…");
    case "fees":
      return fetchFeeReport(slug, filters);
    case "examinations":
      return fetchExamReport(slug, filters);
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

function fetchStudentReport(slug: string, filters: ReportFilters): ReportData {
  switch (slug) {
    case "list":
      return studentListData(filters);
    case "active":
      return studentListData(filters, "ACTIVE");
    case "inactive":
      return studentListData(filters, "INACTIVE");
    case "graduated":
      return studentListData(filters, "GRADUATED");
    case "male": {
      const f = { ...filters, gender: "MALE" };
      return studentListData(f, "ACTIVE");
    }
    case "female": {
      const f = { ...filters, gender: "FEMALE" };
      return studentListData(f, "ACTIVE");
    }
    case "registration": {
      const rows = filterStudents(filters).sort(
        (a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime(),
      );
      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Name" },
          { key: "className", label: "Class" },
          { key: "section", label: "Section" },
          { key: "registered", label: "Registration Date" },
          { key: "status", label: "Status" },
        ],
        rows: rows.map((s) => ({
          code: s.code,
          name: s.fullName,
          className: s.className,
          section: s.section ?? "—",
          registered: shortDate(s.registrationDate),
          status: s.status,
        })),
        summary: [
          { label: "Total", value: String(rows.length) },
          { label: "This Month", value: String(rows.filter((s) => {
            const d = new Date(s.registrationDate);
            const n = new Date();
            return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
          }).length) },
        ],
      };
    }
    case "by-class": {
      const rows = filterStudents(filters);
      const map = new Map<string, number>();
      for (const s of rows) map.set(s.className, (map.get(s.className) ?? 0) + 1);
      const data = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
      return {
        columns: [
          { key: "className", label: "Class" },
          { key: "count", label: "Students", align: "right" },
        ],
        rows: data.map(([className, count]) => ({ className, count })),
        summary: [
          { label: "Classes", value: String(data.length) },
          { label: "Total Students", value: String(rows.length) },
        ],
      };
    }
    case "by-section": {
      const rows = filterStudents(filters);
      const map = new Map<string, number>();
      for (const s of rows) {
        const key = `${s.className} — ${s.section ?? "No Section"}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      const data = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      return {
        columns: [
          { key: "group", label: "Class / Section" },
          { key: "count", label: "Students", align: "right" },
        ],
        rows: data.map(([group, count]) => ({ group, count })),
        summary: [{ label: "Total Students", value: String(rows.length) }],
      };
    }
    case "parent-list": {
      const st = getStudentsState();
      const parents = listParents(st).filter((p) => {
        if (filters.status && p.status !== filters.status) return false;
        const q = filters.search?.trim().toLowerCase();
        if (q && !`${p.code} ${p.name} ${p.phone}`.toLowerCase().includes(q)) return false;
        return true;
      });
      return {
        columns: [
          { key: "code", label: "Parent ID", mono: true },
          { key: "name", label: "Name" },
          { key: "phone", label: "Phone" },
          { key: "children", label: "Children", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows: parents.map((p) => ({
          code: p.code,
          name: p.name,
          phone: p.phone,
          children: p.childCount,
          status: p.status,
        })),
        summary: [
          { label: "Total Parents", value: String(parents.length) },
          { label: "Multi-Child", value: String(parents.filter((p) => p.childCount > 1).length) },
        ],
      };
    }
    case "parent-relationships": {
      const rows = filterStudents(filters);
      return {
        columns: [
          { key: "student", label: "Student" },
          { key: "studentId", label: "Student ID", mono: true },
          { key: "parent", label: "Parent" },
          { key: "parentId", label: "Parent ID", mono: true },
          { key: "phone", label: "Phone" },
          { key: "className", label: "Class" },
        ],
        rows: rows.map((s) => ({
          student: s.fullName,
          studentId: s.code,
          parent: s.parent.name,
          parentId: s.parent.code,
          phone: s.parent.phone,
          className: s.className,
        })),
        summary: [{ label: "Relationships", value: String(rows.length) }],
      };
    }
    default:
      return emptyReport("Unknown student report");
  }
}

function fetchTeacherReport(slug: string, filters: ReportFilters): ReportData {
  const tt = getTeachersState();
  const q = filters.search?.trim().toLowerCase() ?? "";
  const year = yearOf(filters);

  switch (slug) {
    case "list": {
      const teachers = tt.teachers.filter((t) => {
        if (filters.shift && t.shift !== filters.shift) return false;
        if (filters.status && t.status !== filters.status) return false;
        if (q && !`${t.code} ${t.fullName} ${t.phone}`.toLowerCase().includes(q)) return false;
        return true;
      });
      const sum = summarize(tt);
      return {
        columns: [
          { key: "code", label: "Teacher ID", mono: true },
          { key: "name", label: "Name" },
          { key: "phone", label: "Phone" },
          { key: "shift", label: "Shift" },
          { key: "salary", label: "Salary", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows: teachers.map((t) => ({
          code: t.code,
          name: t.fullName,
          phone: t.phone,
          shift: t.shift.charAt(0) + t.shift.slice(1).toLowerCase(),
          salary: money(t.salary),
          status: t.status,
        })),
        summary: [
          { label: "Total", value: String(teachers.length) },
          { label: "Active", value: String(sum.active) },
        ],
      };
    }
    case "assignments": {
      let assigns = tt.assignments.filter((a) => a.status === "ACTIVE");
      if (filters.academicYear) assigns = assigns.filter((a) => a.academicYear === filters.academicYear);
      if (filters.className) assigns = assigns.filter((a) => a.className === filters.className);
      if (filters.subject) assigns = assigns.filter((a) => a.subject === filters.subject);
      return {
        columns: [
          { key: "teacher", label: "Teacher" },
          { key: "subject", label: "Subject" },
          { key: "className", label: "Class" },
          { key: "section", label: "Section" },
          { key: "year", label: "Academic Year" },
        ],
        rows: assigns.map((a) => ({
          teacher: tt.teachers.find((t) => t.id === a.teacherId)?.fullName ?? "—",
          subject: a.subject,
          className: a.className,
          section: a.section ? `Section ${a.section}` : "All",
          year: a.academicYear,
        })),
        summary: [{ label: "Assignments", value: String(assigns.length) }],
      };
    }
    case "attendance":
      return emptyReport("Use async report loader for attendance data.");
    case "salary": {
      const teachers = tt.teachers.filter((t) => t.status === "ACTIVE");
      const total = teachers.reduce((s, t) => s + t.salary, 0);
      return {
        columns: [
          { key: "code", label: "ID", mono: true },
          { key: "name", label: "Teacher" },
          { key: "shift", label: "Shift" },
          { key: "salary", label: "Monthly Salary", align: "right" },
        ],
        rows: teachers.map((t) => ({
          code: t.code,
          name: t.fullName,
          shift: t.shift,
          salary: money(t.salary),
        })),
        summary: [
          { label: "Teachers", value: String(teachers.length) },
          { label: "Monthly Total", value: money(total) },
        ],
      };
    }
    case "subjects":
    case "classes":
    case "sections": {
      let assigns = tt.assignments.filter(
        (a) => a.status === "ACTIVE" && a.academicYear === (filters.academicYear || year),
      );
      if (filters.className) assigns = assigns.filter((a) => a.className === filters.className);
      if (filters.section) assigns = assigns.filter((a) => a.section === filters.section);
      if (filters.subject) assigns = assigns.filter((a) => a.subject === filters.subject);
      const key = slug === "subjects" ? "subject" : slug === "classes" ? "className" : "section";
      const map = new Map<string, number>();
      for (const a of assigns) {
        const val = key === "section" ? `${a.className} ${a.section ?? "All"}` : a[key as "subject" | "className"];
        map.set(String(val), (map.get(String(val)) ?? 0) + 1);
      }
      return {
        columns: [
          { key: "name", label: slug === "subjects" ? "Subject" : slug === "classes" ? "Class" : "Section" },
          { key: "count", label: "Assignments", align: "right" },
        ],
        rows: [...map.entries()].map(([name, count]) => ({ name, count })),
        summary: [{ label: "Total", value: String(assigns.length) }],
      };
    }
    default:
      return emptyReport("Unknown teacher report");
  }
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

function fetchFeeReport(slug: string, filters: ReportFilters): ReportData {
  const year = yearOf(filters);
  const fees = getFeesState();

  switch (slug) {
    case "monthly-collections":
    case "daily-collections": {
      let payments = [...fees.payments];
      const st = getStudentsState();
      const smap = new Map(st.students.map((s) => [s.id, s]));
      if (filters.className) {
        const ids = new Set(
          st.students.filter((s) => s.className === filters.className).map((s) => s.id),
        );
        payments = payments.filter((p) => ids.has(p.studentId));
      }
      if (slug === "daily-collections" && filters.dateFrom) {
        payments = payments.filter((p) => p.collectedAt >= filters.dateFrom!);
      }
      return {
        columns: [
          { key: "receipt", label: "Receipt", mono: true },
          { key: "student", label: "Student" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "type", label: "Type" },
          { key: "date", label: "Date" },
        ],
        rows: payments.map((p) => ({
          receipt: p.receiptNo,
          student: smap.get(p.studentId)?.fullName ?? p.studentId,
          amount: money(p.amount),
          type: p.paymentType,
          date: shortDate(p.collectedAt),
        })),
        summary: [
          { label: "Payments", value: String(payments.length) },
          { label: "Total", value: money(payments.reduce((s, p) => s + p.amount, 0)) },
        ],
      };
    }
    case "outstanding":
    case "partial":
    case "advance": {
      const rows = listStudentFees({
        academicYear: year,
        className: filters.className,
        section: filters.section,
        search: filters.search,
      });
      const filtered = rows.filter((r) => {
        if (slug === "outstanding") return r.outstandingBalance > 0;
        if (slug === "partial") return r.status === "PARTIAL";
        if (slug === "advance") return r.status === "ADVANCE" || r.status === "ADVANCE_MULTI";
        return true;
      });
      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Name" },
          { key: "className", label: "Class" },
          { key: "outstanding", label: "Outstanding", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows: filtered.map((r) => ({
          code: r.code,
          name: r.fullName,
          className: r.className,
          outstanding: money(r.outstandingBalance),
          status: r.status,
        })),
        summary: [
          { label: "Students", value: String(filtered.length) },
          { label: "Total Due", value: money(filtered.reduce((s, r) => s + r.outstandingBalance, 0)) },
        ],
      };
    }
    case "ledger": {
      const students = filterStudents({ ...filters, academicYear: year }, "ACTIVE");
      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Name" },
          { key: "className", label: "Class" },
          { key: "monthlyFee", label: "Monthly Fee", align: "right" },
          { key: "outstanding", label: "Balance", align: "right" },
        ],
        rows: students.map((s) => ({
          code: s.code,
          name: s.fullName,
          className: s.className,
          monthlyFee: money(s.monthlyFee),
          outstanding: money(outstandingBalance(s.id)),
        })),
        summary: [{ label: "Students", value: String(students.length) }],
      };
    }
    case "by-class":
    case "by-section": {
      const rows = listStudentFees({ academicYear: year, className: filters.className });
      const map = new Map<string, { collected: number; due: number }>();
      for (const r of rows) {
        const key = slug === "by-section" ? `${r.className} — ${r.section ?? "—"}` : r.className;
        const cur = map.get(key) ?? { collected: 0, due: 0 };
        cur.due += r.monthlyFee;
        if (r.status === "PAID") cur.collected += r.monthlyFee;
        map.set(key, cur);
      }
      return {
        columns: [
          { key: "group", label: slug === "by-section" ? "Class / Section" : "Class" },
          { key: "collected", label: "Collected", align: "right" },
          { key: "due", label: "Expected", align: "right" },
        ],
        rows: [...map.entries()].map(([group, v]) => ({
          group,
          collected: money(v.collected),
          due: money(v.due),
        })),
        summary: [{ label: "Groups", value: String(map.size) }],
      };
    }
    case "academic-year-summary": {
      const students = filterStudents({ ...filters, academicYear: year }, "ACTIVE");
      const rows = students.map((s) => {
        const sum = studentAnnualSummary(s.id);
        return {
          code: s.code,
          name: s.fullName,
          className: s.className,
          monthlyFee: money(s.monthlyFee),
          annualFee: money(sum.totalDue),
          paid: money(sum.totalPaid),
          outstanding: money(sum.outstanding),
          progress: `${sum.paidMonths}/${sum.totalMonths} (${sum.progressPercent}%)`,
        };
      });
      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Name" },
          { key: "className", label: "Class" },
          { key: "monthlyFee", label: "Monthly Fee", align: "right" },
          { key: "annualFee", label: "Annual Fee", align: "right" },
          { key: "paid", label: "Paid", align: "right" },
          { key: "outstanding", label: "Outstanding", align: "right" },
          { key: "progress", label: "Progress" },
        ],
        rows,
        summary: [
          { label: "Students", value: String(rows.length) },
          {
            label: "Total Outstanding",
            value: money(
              students.reduce((n, s) => n + studentAnnualSummary(s.id).outstanding, 0),
            ),
          },
        ],
      };
    }
    case "monthly-progress": {
      const students = filterStudents({ ...filters, academicYear: year }, "ACTIVE");
      const monthFilter = filters.month;
      const rows: Record<string, string>[] = [];
      for (const s of students) {
        const charges = studentCharges(s.id).filter((c) => {
          if (monthFilter && c.monthKey !== monthFilter) return false;
          return true;
        });
        for (const c of charges) {
          rows.push({
            code: s.code,
            name: s.fullName,
            className: s.className,
            month: monthLabel(c.monthKey),
            charge: money(c.monthlyFee),
            paid: money(c.amountPaid),
            balance: money(c.balance),
            status: c.status,
          });
        }
      }
      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Name" },
          { key: "className", label: "Class" },
          { key: "month", label: "Month" },
          { key: "charge", label: "Charge", align: "right" },
          { key: "paid", label: "Paid", align: "right" },
          { key: "balance", label: "Balance", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows,
        summary: [{ label: "Records", value: String(rows.length) }],
      };
    }
    case "paid-months": {
      const students = filterStudents({ ...filters, academicYear: year }, "ACTIVE");
      const monthFilter = filters.month;
      const rows: Record<string, string>[] = [];
      let totalPaid = 0;
      for (const s of students) {
        for (const c of studentCharges(s.id)) {
          if (c.status !== "PAID") continue;
          if (monthFilter && c.monthKey !== monthFilter) continue;
          totalPaid += c.monthlyFee;
          rows.push({
            code: s.code,
            name: s.fullName,
            className: s.className,
            month: monthLabel(c.monthKey),
            amount: money(c.monthlyFee),
          });
        }
      }
      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Name" },
          { key: "className", label: "Class" },
          { key: "month", label: "Month" },
          { key: "amount", label: "Amount", align: "right" },
        ],
        rows,
        summary: [
          { label: "Paid Months", value: String(rows.length) },
          { label: "Total", value: money(totalPaid) },
        ],
      };
    }
    case "outstanding-months": {
      const students = filterStudents({ ...filters, academicYear: year }, "ACTIVE");
      const monthFilter = filters.month;
      const rows: Record<string, string>[] = [];
      let totalDue = 0;
      for (const s of students) {
        for (const c of studentCharges(s.id)) {
          if (c.status === "INACTIVE" || c.status === "PAID") continue;
          if (monthFilter && c.monthKey !== monthFilter) continue;
          totalDue += c.balance;
          rows.push({
            code: s.code,
            name: s.fullName,
            className: s.className,
            month: monthLabel(c.monthKey),
            charge: money(c.monthlyFee),
            paid: money(c.amountPaid),
            balance: money(c.balance),
            status: c.status,
          });
        }
      }
      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Name" },
          { key: "className", label: "Class" },
          { key: "month", label: "Month" },
          { key: "charge", label: "Charge", align: "right" },
          { key: "paid", label: "Paid", align: "right" },
          { key: "balance", label: "Balance", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows,
        summary: [
          { label: "Outstanding Months", value: String(rows.length) },
          { label: "Total Due", value: money(totalDue) },
        ],
      };
    }
    case "agreement-fee": {
      const students = filterStudents({ ...filters, academicYear: year }, "ACTIVE");
      const rows: Record<string, string>[] = [];
      for (const s of students) {
        if (s.feeStartMode !== "AGREEMENT") {
          const agreementCharge = studentCharges(s.id).find(
            (c) =>
              c.status !== "INACTIVE" &&
              c.monthlyFee < s.monthlyFee &&
              (c.status === "PARTIAL" || c.status === "UNPAID"),
          );
          if (!agreementCharge) continue;
          rows.push({
            code: s.code,
            name: s.fullName,
            className: s.className,
            standardFee: money(s.monthlyFee),
            agreementFee: money(agreementCharge.monthlyFee),
            month: monthLabel(agreementCharge.monthKey),
            balance: money(agreementCharge.balance),
          });
          continue;
        }
        const agreementCharge = studentCharges(s.id).find(
          (c) => c.status !== "INACTIVE" && c.monthlyFee <= (s.feeAgreementAmount ?? s.monthlyFee),
        );
        rows.push({
          code: s.code,
          name: s.fullName,
          className: s.className,
          standardFee: money(s.monthlyFee),
          agreementFee: money(s.feeAgreementAmount ?? agreementCharge?.monthlyFee ?? 0),
          month: agreementCharge ? monthLabel(agreementCharge.monthKey) : "—",
          balance: money(agreementCharge?.balance ?? 0),
        });
      }
      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Name" },
          { key: "className", label: "Class" },
          { key: "month", label: "Month" },
          { key: "standardFee", label: "Standard Fee", align: "right" },
          { key: "agreementFee", label: "Agreement", align: "right" },
          { key: "balance", label: "Balance", align: "right" },
        ],
        rows,
        summary: [{ label: "Students", value: String(rows.length) }],
      };
    }
    case "new-student-adjustment": {
      const students = filterStudents({ ...filters, academicYear: year }, "ACTIVE");
      const rows: Record<string, string>[] = [];
      for (const s of students) {
        const charges = studentCharges(s.id);
        const inactive = charges.filter((c) => c.status === "INACTIVE").length;
        const hasAdjustment =
          inactive > 0 ||
          s.feeStartMode === "AGREEMENT" ||
          s.feeStartMode === "NEXT_MONTH";
        if (!hasAdjustment) continue;
        const firstActive = charges.find((c) => c.status !== "INACTIVE");
        const modeLabel =
          s.feeStartMode === "FULL_CURRENT"
            ? "Full current month"
            : s.feeStartMode === "AGREEMENT"
              ? `Agreement (${money(s.feeAgreementAmount ?? 0)})`
              : s.feeStartMode === "NEXT_MONTH"
                ? "Starts next month"
                : inactive > 0
                  ? `${inactive} inactive month(s)`
                  : "Adjusted";
        rows.push({
          code: s.code,
          name: s.fullName,
          className: s.className,
          registered: shortDate(s.registrationDate),
          inactiveMonths: String(inactive),
          billingStarts: firstActive ? monthLabel(firstActive.monthKey) : "—",
          annualFee: money(s.annualFeeAmount ?? studentAnnualSummary(s.id).totalDue),
          adjustment: modeLabel,
        });
      }
      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Name" },
          { key: "className", label: "Class" },
          { key: "registered", label: "Registered" },
          { key: "billingStarts", label: "Billing Starts" },
          { key: "inactiveMonths", label: "Inactive", align: "right" },
          { key: "annualFee", label: "Adjusted Annual", align: "right" },
          { key: "adjustment", label: "Adjustment" },
        ],
        rows,
        summary: [{ label: "Adjusted Students", value: String(rows.length) }],
      };
    }
    case "carry-forward": {
      const students = filterStudents({ ...filters, academicYear: year }, "ACTIVE");
      const rows: Record<string, string>[] = [];
      let totalCarried = 0;
      for (const s of students) {
        for (const c of studentCharges(s.id)) {
          if (c.status === "INACTIVE") continue;
          const carried = c.monthlyFee - s.monthlyFee;
          if (carried <= 0) continue;
          totalCarried += carried;
          rows.push({
            code: s.code,
            name: s.fullName,
            className: s.className,
            month: monthLabel(c.monthKey),
            standardFee: money(s.monthlyFee),
            charged: money(c.monthlyFee),
            carried: money(carried),
            balance: money(c.balance),
          });
        }
      }
      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Name" },
          { key: "className", label: "Class" },
          { key: "month", label: "Month" },
          { key: "standardFee", label: "Standard", align: "right" },
          { key: "charged", label: "Charged", align: "right" },
          { key: "carried", label: "Carried", align: "right" },
          { key: "balance", label: "Balance", align: "right" },
        ],
        rows,
        summary: [
          { label: "Records", value: String(rows.length) },
          { label: "Total Carried", value: money(totalCarried) },
        ],
      };
    }
    default:
      return emptyReport("Unknown fee report");
  }
}

function fetchExamReport(slug: string, filters: ReportFilters): ReportData {
  const year = yearOf(filters);
  const ex = getExaminationsState();
  const students = getStudentsState().students.filter((s) => s.academicYear === year && s.status === "ACTIVE");

  if (slug === "submission-status") {
    const rows = monitoringRows().filter((r) => {
      if (filters.examId && r.examId !== filters.examId) return false;
      if (filters.className && r.className !== filters.className) return false;
      return true;
    });
    return {
      columns: [
        { key: "exam", label: "Exam" },
        { key: "className", label: "Class" },
        { key: "subject", label: "Subject" },
        { key: "teacher", label: "Teacher" },
        { key: "status", label: "Status" },
      ],
      rows: rows.map((r) => ({
        exam: r.examName,
        className: r.className,
        subject: r.subject,
        teacher: r.teacherName,
        status: r.status,
      })),
      summary: [{ label: "Rows", value: String(rows.length) }],
    };
  }

  const classFilter = filters.className;
  const sectionFilter = filters.section;
  const results: { student: string; code: string; className: string; average: string; grade: string; passed: string }[] = [];

  for (const s of students) {
    if (classFilter && s.className !== classFilter) continue;
    if (sectionFilter && (s.section ?? "") !== sectionFilter) continue;
    const fr = studentFinalResult(s.id, undefined, year);
    if (!fr) continue;
    results.push({
      student: s.fullName,
      code: s.code,
      className: s.className,
      average: fr.finalAverage.toFixed(1),
      grade: fr.finalGrade,
      passed: fr.passed ? "Pass" : "Fail",
    });
  }

  if (slug === "rankings") {
    results.sort((a, b) => Number(b.average) - Number(a.average));
    return {
      columns: [
        { key: "rank", label: "#", align: "right" },
        { key: "student", label: "Student" },
        { key: "code", label: "ID", mono: true },
        { key: "average", label: "Average", align: "right" },
        { key: "grade", label: "Grade" },
      ],
      rows: results.map((r, i) => ({ rank: i + 1, ...r })),
      summary: [{ label: "Students", value: String(results.length) }],
    };
  }

  if (slug === "grade-distribution") {
    const map = new Map<string, number>();
    for (const r of results) map.set(r.grade, (map.get(r.grade) ?? 0) + 1);
    return {
      columns: [
        { key: "grade", label: "Grade" },
        { key: "count", label: "Students", align: "right" },
      ],
      rows: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([grade, count]) => ({ grade, count })),
      summary: [{ label: "Total", value: String(results.length) }],
    };
  }

  if (slug === "pass-fail") {
    const pass = results.filter((r) => r.passed === "Pass").length;
    const fail = results.length - pass;
    return {
      columns: [
        { key: "outcome", label: "Outcome" },
        { key: "count", label: "Students", align: "right" },
        { key: "percent", label: "%", align: "right" },
      ],
      rows: [
        { outcome: "Pass", count: pass, percent: results.length ? `${((pass / results.length) * 100).toFixed(1)}%` : "0%" },
        { outcome: "Fail", count: fail, percent: results.length ? `${((fail / results.length) * 100).toFixed(1)}%` : "0%" },
      ],
      summary: [{ label: "Total", value: String(results.length) }],
    };
  }

  if (slug === "term-results") {
    const exams = ex.exams.filter((e) => e.academicYear === year && (!filters.term || e.term === filters.term));
    return {
      columns: [
        { key: "exam", label: "Exam" },
        { key: "term", label: "Term" },
        { key: "className", label: "Class" },
        { key: "status", label: "Status" },
      ],
      rows: exams.map((e) => ({
        exam: e.name,
        term: e.term,
        className: e.className,
        status: e.status,
      })),
      summary: [{ label: "Exams", value: String(exams.length) }],
    };
  }

  return {
    columns: [
      { key: "student", label: "Student" },
      { key: "code", label: "ID", mono: true },
      { key: "className", label: "Class" },
      { key: "average", label: "Average", align: "right" },
      { key: "grade", label: "Grade" },
      { key: "passed", label: "Result" },
    ],
    rows: results,
    summary: [
      { label: "Students", value: String(results.length) },
      { label: "Pass Rate", value: results.length ? `${((results.filter((r) => r.passed === "Pass").length / results.length) * 100).toFixed(1)}%` : "0%" },
    ],
  };
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
