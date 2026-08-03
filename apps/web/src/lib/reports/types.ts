export type ReportFilterKey =
  | "academicYear"
  | "className"
  | "section"
  | "gender"
  | "status"
  | "month"
  | "date"
  | "dateFrom"
  | "dateTo"
  | "shift"
  | "examId"
  | "term"
  | "subject"
  | "paymentStatus"
  | "teacherId"
  | "category";

export interface ReportFilters {
  search?: string;
  academicYear?: string;
  className?: string;
  section?: string;
  gender?: string;
  status?: string;
  month?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  shift?: string;
  examId?: string;
  term?: string;
  subject?: string;
  paymentStatus?: string;
  teacherId?: string;
  category?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
}

export interface ReportSummaryItem {
  label: string;
  value: string;
}

export interface ReportData {
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  summary: ReportSummaryItem[];
}

export interface ReportDef {
  slug: string;
  title: string;
  description: string;
  filters: ReportFilterKey[];
  /**
   * Chart the report's rows as a bar chart, when the data naturally groups
   * into a handful of categories (a class, a section, a month) rather than
   * one bar per row of a long list. `yKey` may point at a column formatted
   * as currency ("$1,234.00") — the chart parses it back to a number.
   */
  chart?: { xKey: string; yKey: string; label: string };
}

export interface ReportCategoryDef {
  id: string;
  label: string;
  description: string;
  reports: ReportDef[];
}

export type ReportAuditAction =
  | "VIEWED"
  | "PRINTED"
  | "PDF_DOWNLOADED"
  | "CSV_EXPORTED"
  | "FILTER_APPLIED";

export interface ReportAuditEntry {
  id: string;
  reportName: string;
  category: string;
  action: ReportAuditAction;
  user: string;
  role: string;
  at: string;
  detail?: string;
}
