import type { ReportCategoryDef, ReportDef } from "./types";

export const REPORT_CATEGORIES: ReportCategoryDef[] = [
  {
    id: "students",
    label: "Student Reports",
    description: "Student lists, demographics, registration, and distribution.",
    reports: [
      { slug: "list", title: "Student List", description: "Complete student register with parent contact.", filters: ["academicYear", "className", "section", "gender", "status"] },
      { slug: "active", title: "Active Students", description: "All currently enrolled active students.", filters: ["academicYear", "className", "section", "gender"] },
      { slug: "inactive", title: "Inactive Students", description: "Students marked inactive.", filters: ["academicYear", "className", "section"] },
      { slug: "graduated", title: "Graduated Students", description: "Students who completed the final class.", filters: ["academicYear", "className"] },
      { slug: "male", title: "Male Students", description: "Male student listing.", filters: ["academicYear", "className", "section"] },
      { slug: "female", title: "Female Students", description: "Female student listing.", filters: ["academicYear", "className", "section"] },
      { slug: "registration", title: "Registration Report", description: "Students by registration date.", filters: ["academicYear", "className", "dateFrom", "dateTo"] },
      { slug: "by-class", title: "Distribution by Class", description: "Student counts per class.", filters: ["academicYear", "gender", "status"] },
      { slug: "by-section", title: "Distribution by Section", description: "Student counts per class and section.", filters: ["academicYear", "className"] },
      { slug: "parent-list", title: "Parent List", description: "All parents with contact details.", filters: ["academicYear", "status"] },
      { slug: "parent-relationships", title: "Parent-Student Relationships", description: "Parent linked to each child.", filters: ["academicYear", "className"] },
    ],
  },
  {
    id: "teachers",
    label: "Teacher Reports",
    description: "Teacher records, assignments, and workload.",
    reports: [
      { slug: "list", title: "Teacher List", description: "All teachers with employment details.", filters: ["shift", "status"] },
      { slug: "assignments", title: "Teacher Assignments", description: "Subject and class assignments per teacher.", filters: ["academicYear", "className", "subject"] },
      { slug: "attendance", title: "Teacher Attendance", description: "Teacher attendance records.", filters: ["date", "shift", "status"] },
      { slug: "salary", title: "Teacher Salary", description: "Salary amounts per teacher.", filters: ["shift", "status"] },
      { slug: "subjects", title: "Subject Assignments", description: "Subjects taught by each teacher.", filters: ["academicYear", "subject"] },
      { slug: "classes", title: "Class Assignments", description: "Classes assigned to teachers.", filters: ["academicYear", "className"] },
      { slug: "sections", title: "Section Assignments", description: "Section-level teacher assignments.", filters: ["academicYear", "className", "section"] },
    ],
  },
  {
    id: "attendance",
    label: "Attendance Reports",
    description: "Student and teacher attendance analytics.",
    reports: [
      { slug: "student-daily", title: "Daily Student Attendance", description: "Attendance for a specific date.", filters: ["academicYear", "date", "className", "section", "status"] },
      { slug: "student-monthly", title: "Monthly Student Attendance", description: "Student attendance summary for the month.", filters: ["academicYear", "month", "className", "section"] },
      { slug: "student-class", title: "Class Attendance", description: "Attendance rates by class.", filters: ["academicYear", "month", "className"] },
      { slug: "student-section", title: "Section Attendance", description: "Attendance rates by section.", filters: ["academicYear", "month", "className"] },
      { slug: "student-history", title: "Student Attendance History", description: "Individual student attendance log.", filters: ["academicYear", "className", "section"] },
      { slug: "teacher-daily", title: "Daily Teacher Attendance", description: "Teacher attendance for a date.", filters: ["date", "shift", "status"] },
      { slug: "teacher-monthly", title: "Monthly Teacher Attendance", description: "Teacher attendance summary.", filters: ["month", "shift"] },
      { slug: "teacher-shift", title: "Shift Attendance", description: "Morning vs afternoon teacher attendance.", filters: ["month", "shift"] },
    ],
  },
  {
    id: "fees",
    label: "Fee Reports",
    description: "Collections, outstanding balances, and ledgers.",
    reports: [
      { slug: "monthly-collections", title: "Monthly Collections", description: "Fee collected per month.", filters: ["academicYear", "month", "className"] },
      { slug: "daily-collections", title: "Daily Collections", description: "Payments collected by day.", filters: ["academicYear", "dateFrom", "dateTo"] },
      { slug: "outstanding", title: "Outstanding Balances", description: "Students with unpaid fees.", filters: ["academicYear", "className", "section", "paymentStatus"] },
      { slug: "partial", title: "Partial Payments", description: "Students with partial payment status.", filters: ["academicYear", "className", "section"] },
      { slug: "advance", title: "Advance Payments", description: "Students with advance fee coverage.", filters: ["academicYear", "className"] },
      { slug: "ledger", title: "Student Fee Ledger", description: "Monthly charge and payment history.", filters: ["academicYear", "className", "section"] },
      { slug: "by-class", title: "Collection by Class", description: "Fee summary grouped by class.", filters: ["academicYear", "month"] },
      { slug: "by-section", title: "Collection by Section", description: "Fee summary grouped by section.", filters: ["academicYear", "className", "month"] },
    ],
  },
  {
    id: "examinations",
    label: "Examination Reports",
    description: "Results, rankings, and submission status.",
    reports: [
      { slug: "class-results", title: "Class Results", description: "Exam results by class.", filters: ["academicYear", "examId", "className"] },
      { slug: "section-results", title: "Section Results", description: "Exam results by section.", filters: ["academicYear", "examId", "className", "section"] },
      { slug: "subject-results", title: "Subject Results", description: "Marks breakdown by subject.", filters: ["academicYear", "examId", "subject"] },
      { slug: "submission-status", title: "Teacher Submission Status", description: "Mark entry progress by teacher.", filters: ["academicYear", "examId", "className"] },
      { slug: "rankings", title: "Student Rankings", description: "Top performers by average.", filters: ["academicYear", "examId", "className", "section"] },
      { slug: "grade-distribution", title: "Grade Distribution", description: "Grade counts across students.", filters: ["academicYear", "examId", "className"] },
      { slug: "pass-fail", title: "Pass / Fail Analysis", description: "Pass and fail statistics.", filters: ["academicYear", "examId", "className"] },
      { slug: "term-results", title: "Term Results", description: "Results grouped by term.", filters: ["academicYear", "term", "className"] },
      { slug: "final-results", title: "Final Results", description: "Weighted final academic results.", filters: ["academicYear", "className", "section"] },
    ],
  },
  {
    id: "promotions",
    label: "Promotion Reports",
    description: "Promotion history and graduation records.",
    reports: [
      { slug: "individual", title: "Individual Promotion", description: "Single-student promotion records.", filters: ["academicYear", "className"] },
      { slug: "class", title: "Class Promotion", description: "Class-level promotion batches.", filters: ["academicYear", "className"] },
      { slug: "school-wide", title: "School Promotion", description: "School-wide promotion activity.", filters: ["academicYear"] },
      { slug: "graduated", title: "Graduated Students", description: "Students who graduated.", filters: ["academicYear", "className"] },
      { slug: "history", title: "Promotion History", description: "Complete promotion audit trail.", filters: ["academicYear", "className", "section"] },
    ],
  },
  {
    id: "salary",
    label: "Salary Reports",
    description: "Staff and teacher salary summaries.",
    reports: [
      { slug: "monthly", title: "Monthly Salary Payments", description: "Salaries due this month.", filters: ["month", "shift", "status"] },
      { slug: "annual", title: "Annual Salary Report", description: "Yearly salary totals.", filters: ["academicYear", "shift"] },
      { slug: "teacher", title: "Teacher Salary Report", description: "Per-teacher salary breakdown.", filters: ["shift", "status"] },
      { slug: "outstanding", title: "Outstanding Salary", description: "Unpaid salary records.", filters: ["month"] },
    ],
  },
  {
    id: "expenses",
    label: "Expense Reports",
    description: "School operational expenses.",
    reports: [
      { slug: "daily", title: "Daily Expenses", description: "Expenses by day.", filters: ["dateFrom", "dateTo", "category"] },
      { slug: "monthly", title: "Monthly Expenses", description: "Expenses by month.", filters: ["month", "category"] },
      { slug: "annual", title: "Annual Expenses", description: "Yearly expense totals.", filters: ["academicYear", "category"] },
      { slug: "categories", title: "Expense Categories", description: "Spending by category.", filters: ["academicYear", "month"] },
      { slug: "summary", title: "Expense Summary", description: "Overview of all expenses.", filters: ["academicYear", "dateFrom", "dateTo"] },
    ],
  },
  {
    id: "financial",
    label: "Financial Reports",
    description: "Income, expenses, and net income.",
    reports: [
      { slug: "income", title: "Income Report", description: "Fee collection income.", filters: ["academicYear", "month"] },
      { slug: "expenses", title: "Expense Report", description: "Total operational expenses.", filters: ["academicYear", "month"] },
      { slug: "salary", title: "Salary Report", description: "Total salary outflow.", filters: ["academicYear", "month"] },
      { slug: "net-income", title: "Net Income Report", description: "Fees − expenses − salaries.", filters: ["academicYear", "month"] },
      { slug: "monthly-statement", title: "Monthly Financial Statement", description: "Full monthly P&L summary.", filters: ["academicYear", "month"] },
    ],
  },
  {
    id: "quiz",
    label: "Quiz Reports",
    description: "Online quiz performance and activity.",
    reports: [
      { slug: "results", title: "Quiz Results", description: "Student quiz scores.", filters: ["academicYear", "className", "section"] },
      { slug: "attempts", title: "Quiz Attempts", description: "Attempt counts per quiz.", filters: ["academicYear", "className"] },
      { slug: "averages", title: "Average Scores", description: "Average scores by class.", filters: ["academicYear", "className", "section"] },
      { slug: "completion", title: "Completion Rates", description: "Quiz completion percentages.", filters: ["academicYear", "className"] },
      { slug: "teacher-activity", title: "Teacher Quiz Activity", description: "Quizzes created per teacher.", filters: ["academicYear"] },
    ],
  },
];

export function getCategory(id: string): ReportCategoryDef | undefined {
  return REPORT_CATEGORIES.find((c) => c.id === id);
}

export function getReport(categoryId: string, slug: string) {
  const cat = getCategory(categoryId);
  return cat?.reports.find((r) => r.slug === slug);
}

export function totalReportCount(): number {
  return REPORT_CATEGORIES.reduce((n, c) => n + c.reports.length, 0);
}

export function searchReports(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: { category: ReportCategoryDef; report: ReportDef }[] = [];
  for (const cat of REPORT_CATEGORIES) {
    for (const report of cat.reports) {
      if (
        report.title.toLowerCase().includes(q) ||
        report.description.toLowerCase().includes(q) ||
        cat.label.toLowerCase().includes(q)
      ) {
        out.push({ category: cat, report });
      }
    }
  }
  return out;
}
