"use client";


import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Columns3,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileType2,
  Filter,
  GraduationCap,
  Hash,
  LayoutGrid,
  Layers,
  MapPin,
  Percent,
  Phone,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Tag,
  User,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { activeAcademicYear, classNamesForYear, getAcademicsState, groupClassNames, sectionNamesForClass, useAcademicsState } from "@/lib/academics/store";
import { api } from "@/lib/api";
import { logReportAction } from "@/lib/reports/audit";
import { fetchReport, fetchReportAsync } from "@/lib/reports/data";
import {
  printReport,
  reportDocumentHtml,
} from "@/lib/reports/print";
import { Dialog } from "@/components/ui/dialog";
import { useShifts } from "@/lib/teachers/shifts";
import { ReportBarChart } from "./report-chart";
import type { ReportDef, ReportFilterKey, ReportFilters } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { REPORT_THEME, REPORT_THEME_FALLBACK } from "@/lib/reports/theme";
import { exportTable, type ExportFormat } from "@/lib/export/table-export";
import { ExportMenu } from "@/components/export/export-menu";
import { toast } from "@/lib/toast";
import { useHydrated } from "@/lib/use-hydrated";
import { ensureVillagesLoaded, useVillagesState } from "@/lib/villages/store";
import { ensureDistrictsLoaded, useDistrictsState } from "@/lib/districts/store";

/** Filter value for students with no village or district recorded. */
const NONE_RECORDED = "__none__";


/**
 * The "status" filter means a different enum per report — Student.status
 * (ACTIVE/INACTIVE/GRADUATED), Teacher.status (ACTIVE/INACTIVE),
 * attendance's AttendanceStatus (PRESENT/ABSENT/LATE/EXCUSED), or
 * Salary.status (PENDING/PAID/PARTIAL). One hardcoded option list sent the
 * attendance-only values to /reports/student-reports and /reports/teacher-reports,
 * which crashed with a Prisma 500 (invalid enum value) — see Platform error logs.
 */
function statusOptionsFor(
  categoryId: string,
  slug: string,
): { value: string; labelKey: string }[] {
  if (categoryId === "students") {
    return [
      { value: "ACTIVE", labelKey: "active" },
      { value: "INACTIVE", labelKey: "inactive" },
      { value: "GRADUATED", labelKey: "graduated" },
    ];
  }
  if (categoryId === "attendance" || slug === "attendance") {
    return [
      { value: "PRESENT", labelKey: "present" },
      { value: "ABSENT", labelKey: "absent" },
      { value: "LATE", labelKey: "late" },
      { value: "EXCUSED", labelKey: "excused" },
    ];
  }
  if (categoryId === "salary") {
    return [
      { value: "PENDING", labelKey: "pending" },
      { value: "PAID", labelKey: "paid" },
      { value: "PARTIAL", labelKey: "partial" },
    ];
  }
  // teachers: list/salary — Teacher.status is EmploymentStatus (ACTIVE/INACTIVE only)
  return [
    { value: "ACTIVE", labelKey: "active" },
    { value: "INACTIVE", labelKey: "inactive" },
  ];
}

const FILTER_LABELS: Record<ReportFilterKey, string> = {
  academicYear: "Academic Year",
  className: "Class",
  section: "Section",
  gender: "Gender",
  status: "Status",
  month: "Month",
  date: "Date",
  dateFrom: "From Date",
  dateTo: "To Date",
  shift: "Shift",
  examId: "Exam",
  term: "Term",
  subject: "Subject",
  paymentStatus: "Payment Status",
  teacherId: "Teacher",
  category: "Category",
  village: "Village",
  district: "District",
};

/** The icon shown inside each filter box. */
const FILTER_ICONS: Partial<Record<ReportFilterKey, LucideIcon>> = {
  academicYear: CalendarDays,
  className: Layers,
  section: LayoutGrid,
  gender: UserRound,
  status: BadgeCheck,
  shift: Clock,
  examId: BookOpen,
  village: MapPin,
  district: MapPin,
};

/**
 * One labelled filter box with its icon inside, so every filter in the grid
 * lines up on the same baseline whatever control it holds.
 */
function FilterField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label className="mb-1.5 block text-xs font-semibold text-foreground/80">{label}</Label>
      <div className={cn("relative", Icon && "[&_input]:ps-9 [&_select]:ps-9")}>
        {Icon && (
          <Icon className="pointer-events-none absolute start-3 top-5 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        {children}
      </div>
    </div>
  );
}

/** Colour and icon for a summary figure, read from what it counts. */
function summaryLook(label: string, i: number): { icon: LucideIcon; tile: string } {
  const l = label.toLowerCase();
  if (/female|girl/.test(l)) return { icon: User, tile: "bg-pink-500/10 text-pink-600 dark:text-pink-400" };
  if (/\bmale|\bboy/.test(l)) return { icon: User, tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  if (/class/.test(l)) return { icon: GraduationCap, tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
  if (/section/.test(l)) return { icon: Layers, tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  if (/rate|%|percent|average/.test(l)) return { icon: Percent, tile: "bg-sky-500/10 text-sky-600 dark:text-sky-400" };
  if (/paid|collect|amount|fee|salar|income|expense|balance|owed|billed|net|\$/.test(l))
    return { icon: CircleDollarSign, tile: "bg-teal-500/10 text-teal-600 dark:text-teal-400" };
  if (/student|teacher|parent|total|record|count|staff/.test(l))
    return { icon: Users, tile: "bg-blue-500/10 text-blue-600 dark:text-blue-400" };
  const cycle = [
    { icon: Hash, tile: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
    { icon: Tag, tile: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    { icon: Filter, tile: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  ];
  return cycle[i % cycle.length]!;
}

/** Status-like words and the badge colour they take. */
const GOOD = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
const WARN = "bg-amber-500/10 text-amber-700 dark:text-amber-400";
const BAD = "bg-rose-500/10 text-rose-700 dark:text-rose-400";
const MUTED = "bg-slate-500/10 text-slate-700 dark:text-slate-300";
const BADGE: Record<string, string> = {
  ACTIVE: GOOD,
  PAID: GOOD,
  PRESENT: GOOD,
  PASS: GOOD,
  PASSED: GOOD,
  SUBMITTED: GOOD,
  COMPLETED: GOOD,
  GRADUATED: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  PROMOTED: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  PARTIAL: WARN,
  PENDING: WARN,
  LATE: WARN,
  EXCUSED: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  DRAFT: MUTED,
  INACTIVE: MUTED,
  UNPAID: BAD,
  ABSENT: BAD,
  FAIL: BAD,
  FAILED: BAD,
  OVERDUE: BAD,
  REVERSED: BAD,
  MALE: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  FEMALE: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
};

const AVATAR = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
];

/** The column that names the person on each row, if there is one. */
function personColumnKey(columns: { key: string; label: string }[]): string | null {
  const c = columns.find((col) =>
    /^(student|teacher|parent|employee|staff)?\s*(full\s*)?name$|^(student|teacher|parent|employee)$/i.test(
      col.label.trim(),
    ),
  );
  return c?.key ?? null;
}

function isPhoneColumn(label: string): boolean {
  return /phone|tel\b|mobile/i.test(label);
}

/**
 * One table cell, dressed for what it holds: an ID as a chip, a person with
 * their initial, a phone with its icon, a status or gender as a badge.
 * Only the look changes — the text is exactly what prints and exports.
 */
function ReportCell({
  value,
  column,
  isPerson,
}: {
  value: string | number | undefined;
  column: { key: string; label: string; mono?: boolean };
  isPerson: boolean;
}) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  const text = String(value);
  const upper = text.trim().toUpperCase();
  if (typeof value === "string" && BADGE[upper]) {
    return (
      <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide", BADGE[upper])}>
        {upper}
      </span>
    );
  }
  if (column.mono) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-medium">
        {text}
      </span>
    );
  }
  if (isPerson) {
    const initial = text.trim().charAt(0).toUpperCase() || "?";
    const tone = AVATAR[initial.charCodeAt(0) % AVATAR.length];
    return (
      <span className="flex min-w-0 items-center gap-2.5">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", tone)}>
          {initial}
        </span>
        <span className="font-medium">{text}</span>
      </span>
    );
  }
  if (isPhoneColumn(column.label)) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
        {text}
      </span>
    );
  }
  return <>{text}</>;
}

/**
 * The headline figures for a report: what the server summarised, filled out
 * from the rows on screen so no report opens on a single lonely card.
 *
 * Only facts read straight off the rows are added — how many, how many boys
 * and girls, how many classes and sections they span, how many in each
 * status, and the total of a money column — and never a second copy of a
 * figure the server already gave.
 */
function headlineStats(
  summary: { label: string; value: string }[],
  columns: { key: string; label: string; align?: string }[],
  rows: Record<string, string | number>[],
): { label: string; value: string }[] {
  const out = [...summary];
  const has = (re: RegExp) => out.some((x) => re.test(x.label.toLowerCase()));
  const col = (re: RegExp) => columns.find((c) => re.test(c.label.trim().toLowerCase()));
  const fmt = (n: number) => n.toLocaleString();
  if (rows.length === 0) return out.slice(0, 5);

  if (!has(/total|records|students|teachers|parents|count|rows/)) {
    out.unshift({ label: "Total Records", value: fmt(rows.length) });
  }
  const gender = col(/^(gender|sex)$/);
  if (gender) {
    const male = rows.filter((r) => String(r[gender.key]).toUpperCase() === "MALE").length;
    const female = rows.filter((r) => String(r[gender.key]).toUpperCase() === "FEMALE").length;
    if (male && !has(/\bmale/)) out.push({ label: "Male", value: fmt(male) });
    if (female && !has(/female/)) out.push({ label: "Female", value: fmt(female) });
  }
  const distinct = (key: string) =>
    new Set(rows.map((r) => String(r[key] ?? "").trim()).filter((v) => v && v !== "—")).size;
  const cls = col(/^class(es)?$|^class name$/);
  if (cls && !has(/class/)) {
    const n = distinct(cls.key);
    if (n) out.push({ label: n === 1 ? "Class" : "Classes", value: fmt(n) });
  }
  const sec = col(/^section$/);
  if (sec && !has(/section/)) {
    const n = distinct(sec.key);
    if (n) out.push({ label: n === 1 ? "Section" : "Sections", value: fmt(n) });
  }
  const status = col(/^(status|result|payment status)$/);
  if (status) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = String(r[status.key] ?? "").trim();
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    // One status for everyone says nothing a total does not.
    if (counts.size > 1) {
      for (const [v, n] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 2)) {
        const label = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        if (!has(new RegExp(`^${label.toLowerCase()}`))) out.push({ label, value: fmt(n) });
      }
    }
  }
  const money = columns.find(
    (c) =>
      c.align === "right" &&
      /amount|paid|collected|balance|fee|salary|total|owed|income|expense/i.test(c.label) &&
      rows.every((r) => typeof r[c.key] === "number" || r[c.key] === undefined || r[c.key] === "—"),
  );
  if (money && !has(new RegExp(money.label.toLowerCase().replace(/[^a-z ]/g, "")))) {
    const sum = rows.reduce((a, r) => a + (typeof r[money.key] === "number" ? (r[money.key] as number) : 0), 0);
    out.push({
      label: `Total ${money.label}`,
      value: sum.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    });
  }
  return out.slice(0, 5);
}

interface Props {
  categoryId: string;
  categoryLabel: string;
  report: ReportDef;
}

interface ReportPeriod {
  firstMonth: string | null;
  lastMonth: string;
  firstDate: string | null;
  lastDate: string;
}

export function ReportPageShell({ categoryId, categoryLabel, report }: Props) {
  const t = useT();
  const shiftOptions = useShifts();
  const mounted = useHydrated();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  // How many rows at once. A list of thirteen pages is thirteen clicks
  // to read, and reading all of it is usually why it was opened.
  const [pageSize, setPageSize] = useState(15);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [refreshKey, setRefreshKey] = useState(0);

  const year = activeAcademicYear();
  const academics = useAcademicsState();
  const reportYear = filters.academicYear || year;
  const classOptions = useMemo(
    () => classNamesForYear(reportYear),
    [reportYear, academics.classes],
  );
  const classGroups = useMemo(
    () => groupClassNames(classOptions, reportYear, t("common.defaultGrades")),
    [classOptions, reportYear, academics.structureTrees, t],
  );
  const villages = useVillagesState();
  const districts = useDistrictsState();
  const wantsVillage = report.filters.includes("village");
  const wantsDistrict = report.filters.includes("district");
  useEffect(() => {
    if (!mounted) return;
    if (wantsVillage) void ensureVillagesLoaded();
    if (wantsDistrict) void ensureDistrictsLoaded();
  }, [mounted, wantsVillage, wantsDistrict]);

  const sectionOptions = useMemo(
    () =>
      filters.className
        ? sectionNamesForClass(filters.className, reportYear)
        : [],
    [filters.className, reportYear, academics.sections],
  );


  useEffect(() => {
    if (!mounted) return;
    logReportAction(categoryLabel, report.title, "VIEWED");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, categoryLabel, report.title]);

  // Categories whose data comes from the API rather than a browser store.
  const needsAsync =
    categoryId === "attendance" ||
    categoryId === "fees" ||
    categoryId === "students" ||
    categoryId === "teachers" ||
    categoryId === "examinations" ||
    categoryId === "promotions" ||
    categoryId === "salary" ||
    categoryId === "expenses" ||
    categoryId === "financial" ||
    categoryId === "quiz";

  // Attendance reports scan a whole month of records — firing that on every
  // keystroke/filter change (the default for every other category) means a
  // query for each half-picked filter combination. Require an explicit Load
  // instead, so it only runs once the filters are actually set.
  const requiresManualLoad = categoryId === "attendance";
  const [hasLoaded, setHasLoaded] = useState(!requiresManualLoad);

  const [data, setData] = useState<ReturnType<typeof fetchReport>>({
    columns: [],
    rows: [],
    summary: [],
  });
  const [dataLoading, setDataLoading] = useState(false);

  // The exam picker used to read from the browser's examinations store, which
  // only ever held whatever the exams pages had loaded — so the dropdown could
  // be empty even when exams existed. It now comes from the same API the report
  // itself queries.
  /**
   * The months this school has actually been running.
   *
   * The month and date boxes were unbounded, so a school that opened in
   * August could be asked for a January statement — and would get one: a
   * stamped document on school letterhead asserting a month the school did
   * not exist for, with zeroes under it. A zero meaning "nothing happened"
   * and a zero meaning "we were not open" are not the same fact, and the
   * printed page cannot tell them apart.
   *
   * Nothing is hidden by the bound: the school's whole history is inside it.
   */
  const [period, setPeriod] = useState<ReportPeriod | null>(null);
  useEffect(() => {
    if (!mounted) return;
    let live = true;
    void api<ReportPeriod>("/reports/period")
      .then((p) => {
        if (live) setPeriod(p);
      })
      // A window that cannot be read must not stop a report being run; the
      // boxes simply stay as open as they were before.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [mounted]);

  const [exams, setExams] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!mounted || categoryId !== "examinations") return;
    const yearId = academics.academicYears.find(
      (y) => y.name === (filters.academicYear || year),
    )?.id;
    if (!yearId) {
      setExams([]);
      return;
    }
    let cancelled = false;
    void api<{ id: string; name: string }[]>(
      `/reports/exam-list?academicYearId=${encodeURIComponent(yearId)}`,
    )
      .then((res) => {
        if (!cancelled) setExams(res);
      })
      .catch(() => {
        if (!cancelled) setExams([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, categoryId, academics.academicYears, filters.academicYear, year]);

  // Switching to a different report (not just changing its filters) always
  // needs a fresh Load click for manual-load categories.
  useEffect(() => {
    if (requiresManualLoad) setHasLoaded(false);
  }, [requiresManualLoad, categoryId, report.slug]);

  useEffect(() => {
    if (!mounted) return;
    if (requiresManualLoad && !hasLoaded) {
      setData({ columns: [], rows: [], summary: [] });
      return;
    }
    // Guards against a race: switching reports before a slower fetch for the
    // PREVIOUS report has resolved must not let that stale response land on
    // top of the new report's data — the title says one report while the
    // table quietly shows another's columns and rows. Clearing to empty first
    // also means stale columns never sit under the new title while a fetch
    // is in flight.
    let cancelled = false;
    setData({ columns: [], rows: [], summary: [] });
    if (needsAsync) {
      setDataLoading(true);
      void fetchReportAsync(categoryId, report.slug, { ...filters, search })
        .then((res) => {
          if (!cancelled) setData(res);
        })
        .finally(() => {
          if (!cancelled) setDataLoading(false);
        });
    } else {
      const res = fetchReport(categoryId, report.slug, { ...filters, search });
      if (!cancelled) setData(res);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, categoryId, report.slug, filters, search, refreshKey, needsAsync, requiresManualLoad, hasLoaded]);

  /**
   * Which columns this report should carry.
   *
   * A report is read for a reason, and the reason is rarely every column the
   * query can return: a bursar printing outstanding balances for a class
   * meeting does not want the admission date, and a wide table folded onto
   * A4 is the fastest way to make a report unreadable. Empty means "all of
   * them", so a report nobody has narrowed behaves exactly as it did.
   *
   * The choice reaches the table, the preview, the printed sheet, the PDF and
   * the CSV alike — an export that quietly carried different columns from the
   * screen would be a second, disagreeing report.
   */
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);

  // A report's columns change with its filters; a key hidden under the old
  // shape must not go on hiding a column that now means something else.
  useEffect(() => {
    setHiddenColumns(new Set());
  }, [categoryId, report.slug]);

  const visibleColumns = useMemo(
    () => data.columns.filter((c) => !hiddenColumns.has(c.key)),
    [data.columns, hiddenColumns],
  );

  function toggleColumn(key: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      // A report with no columns is a blank page; the last one stays.
      else if (data.columns.length - next.size > 1) next.add(key);
      return next;
    });
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data.rows;
    return [...data.rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data.rows, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => setPage(1), [search, filters, sortKey, sortDir]);

  const setFilter = useCallback((key: keyof ReportFilters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    logReportAction(categoryLabel, report.title, "FILTER_APPLIED", key);
  }, [categoryLabel, report.title]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  /**
   * One description of the document, used by preview, print, PDF alike.
   *
   * The three used to build their own argument lists, which is how a preview
   * and a printout drift apart. The scope lines are the filters as chosen, so
   * a sheet passed around a meeting says what it covers rather than leaving
   * everyone to assume.
   */
  const documentOptions = useMemo(
    () => ({
      title: report.title,
      academicYear: filters.academicYear ?? year,
      scope: (Object.keys(FILTER_LABELS) as (keyof typeof FILTER_LABELS)[])
        .filter((k) => k !== "academicYear" && filters[k as ReportFilterKey])
        .map((k) => ({
          label: FILTER_LABELS[k],
          value:
            filters[k as ReportFilterKey] === NONE_RECORDED
              ? "None recorded"
              : String(filters[k as ReportFilterKey]),
        }))
        .concat(search.trim() ? [{ label: "Search", value: search.trim() }] : []),
      data: { ...data, columns: visibleColumns, rows: sorted },
    }),
    [report.title, filters, year, data, visibleColumns, sorted, search],
  );

  /**
   * A report with no columns has not run; it is waiting on something.
   *
   * The exam reports answer "pick an exam to run this report" by returning no
   * columns at all, and the table rendered that as "No records match your
   * filters" — which says the school has no results when it says nothing of
   * the kind. When a report comes back shaped like a prompt, the prompt is
   * what gets shown.
   */
  const awaitingInput = !dataLoading && data.columns.length === 0;
  const prompt = awaitingInput ? data.summary[0] : undefined;
  const hasDocument = data.columns.length > 0 && sorted.length > 0;
  const stats = useMemo(
    () => headlineStats(data.summary, data.columns, data.rows),
    [data],
  );

  const [previewOpen, setPreviewOpen] = useState(false);
  const previewHtml = useMemo(
    () => (previewOpen ? reportDocumentHtml(documentOptions) : ""),
    [previewOpen, documentOptions],
  );

  function handlePrint() {
    printReport(documentOptions);
    logReportAction(categoryLabel, report.title, "PRINTED");
    toast("Opening print preview…", "info");
  }

  /**
   * Download the report — PDF and Excel built on the school's letterhead by
   * the server, Word and CSV here — with exactly the columns and rows on
   * screen, and the filters written under the title.
   */
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  async function handleExport(format: ExportFormat) {
    setExporting(format);
    try {
      await exportTable(format, {
        title: report.title,
        subtitle: [
          `Academic Year: ${documentOptions.academicYear}`,
          ...(documentOptions.scope.length
            ? [documentOptions.scope.map((x) => `${x.label}: ${x.value}`).join(" · ")]
            : []),
        ],
        columns: visibleColumns.map((c) => ({ key: c.key, label: c.label, align: c.align })),
        rows: sorted,
      });
      logReportAction(
        categoryLabel,
        report.title,
        format === "pdf" ? "PDF_DOWNLOADED" : format === "csv" ? "CSV_EXPORTED" : "EXCEL_EXPORTED",
        format,
      );
      toast(`Exported ${sorted.length} rows.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "The export could not be created.", "error");
    } finally {
      setExporting(null);
    }
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("reportsReportPageShell.loadingReport")}
      </div>
    );
  }

  const years = getAcademicsState().academicYears;
  const theme = REPORT_THEME[categoryId] ?? REPORT_THEME_FALLBACK;
  const ThemeIcon = theme.icon;
  const personKey = personColumnKey(visibleColumns);

  return (
    <div className="relative space-y-6">
      {/* Soft wash behind the header, as on the Reports Center. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 h-72 rounded-b-[3rem] bg-gradient-to-br from-violet-200/50 via-indigo-100/30 to-transparent dark:from-violet-900/25 dark:via-indigo-900/10 sm:-inset-x-6"
      />

      <Link
        href={`/reports/${categoryId}`}
        className="relative inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("reportsReportPageShell.backTo")} {categoryLabel}
      </Link>

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm", theme.tile)}>
            <ThemeIcon className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{report.title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{report.description}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("reportsReportPageShell.academicYear")}{" "}
              <span className="font-semibold text-foreground">{filters.academicYear ?? year}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setPreviewOpen(true)} disabled={!hasDocument} className="shadow-sm shadow-primary/30">
            <Eye className="me-2 h-4 w-4" /> Preview
          </Button>
          <Button variant="outline" className="bg-card" onClick={handlePrint} disabled={!hasDocument}>
            <Printer className="me-2 h-4 w-4" /> {t("reportsReportPageShell.print")}
          </Button>
          <Button variant="outline" className="bg-card" onClick={() => void handleExport("pdf")} disabled={!hasDocument || exporting !== null}>
            <FileText className="me-2 h-4 w-4 text-rose-600" /> {t("reportsReportPageShell.pdf")}
          </Button>
          <Button variant="outline" className="bg-card" onClick={() => void handleExport("docx")} disabled={!hasDocument || exporting !== null}>
            <FileType2 className="me-2 h-4 w-4 text-blue-600" /> Word
          </Button>
          <Button variant="outline" className="bg-card" onClick={() => void handleExport("xlsx")} disabled={!hasDocument || exporting !== null}>
            <FileSpreadsheet className="me-2 h-4 w-4 text-emerald-600" /> Excel
          </Button>
          <Button variant="outline" className="bg-card" onClick={() => void handleExport("csv")} disabled={!hasDocument || exporting !== null}>
            <FileDown className="me-2 h-4 w-4" /> {t("reportsReportPageShell.csv")}
          </Button>
        </div>
      </div>

      {stats.length > 0 && !awaitingInput && !dataLoading && (
        <div
          className={cn(
            "relative grid grid-cols-2 gap-3",
            stats.length >= 5 ? "sm:grid-cols-3 lg:grid-cols-5" : stats.length === 4 ? "lg:grid-cols-4" : stats.length === 3 ? "sm:grid-cols-3" : "",
          )}
        >
          {stats.map((s, i) => {
            const look = summaryLook(s.label, i);
            const Icon = look.icon;
            return (
              <div key={s.label} className="flex min-w-0 items-center gap-3 rounded-2xl border bg-card/90 p-4 shadow-sm backdrop-blur">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", look.tile)}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xl font-bold tabular-nums leading-tight">{s.value}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("reportsReportPageShell.searchReport")}
              className="h-10 w-full rounded-lg border bg-background ps-9 pe-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="hidden flex-1 lg:block" />
          <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="me-2 h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
          <div className="relative">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setColumnsOpen((v) => !v)}
              disabled={data.columns.length === 0}
            >
              <Columns3 className="me-2 h-4 w-4" />
              Columns
              {hiddenColumns.size > 0 && (
                <span className="ms-2 rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                  {visibleColumns.length}/{data.columns.length}
                </span>
              )}
            </Button>
            {columnsOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setColumnsOpen(false)}
                />
                <div className="absolute end-0 z-50 mt-1 w-60 rounded-xl border bg-card p-2 shadow-lg">
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    Fields on this report
                  </p>
                  <ul className="max-h-64 space-y-0.5 overflow-auto scrollbar-slim">
                    {data.columns.map((c) => (
                      <li key={c.key}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
                          <input
                            type="checkbox"
                            checked={!hiddenColumns.has(c.key)}
                            onChange={() => toggleColumn(c.key)}
                          />
                          <span className="truncate">{c.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {hiddenColumns.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setHiddenColumns(new Set())}
                      className="mt-1 w-full rounded-lg px-2 py-1.5 text-start text-xs font-medium text-primary hover:bg-secondary"
                    >
                      Show all fields
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {requiresManualLoad ? (
            <Button
              onClick={() => {
                setHasLoaded(true);
                setRefreshKey((k) => k + 1);
              }}
              disabled={dataLoading}
            >
              <RefreshCw className="me-2 h-4 w-4" /> {dataLoading ? "Loading…" : "Load Report"}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="me-2 h-4 w-4" /> {t("reportsReportPageShell.refresh")}
            </Button>
          )}
          </div>
        </div>

        {showFilters && report.filters.length > 0 && (
          <div className="mt-4 grid items-end gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {report.filters.includes("academicYear") && (
              <FilterField label={FILTER_LABELS.academicYear} icon={FILTER_ICONS.academicYear}>
                <Select value={filters.academicYear ?? ""} onChange={(e) => setFilter("academicYear", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.current")}{year})</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.name}>{y.name}</option>
                  ))}
                </Select>
              </FilterField>
            )}
            {report.filters.includes("className") && (
              <FilterField label={FILTER_LABELS.className} icon={FILTER_ICONS.className}>
                <Select value={filters.className ?? ""} onChange={(e) => setFilters((f) => ({ ...f, className: e.target.value, section: "" }))}>
                  <option value="">{t("reportsReportPageShell.allClasses")}</option>
                  {classGroups.map((g) =>
                    g.label === null ? (
                      g.names.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))
                    ) : (
                      <optgroup key={g.label} label={g.label}>
                        {g.names.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </optgroup>
                    ),
                  )}
                </Select>
              </FilterField>
            )}
            {report.filters.includes("section") && (
              <FilterField label={FILTER_LABELS.section} icon={FILTER_ICONS.section}>
                <Select
                  value={filters.section ?? ""}
                  onChange={(e) => setFilter("section", e.target.value)}
                  disabled={!filters.className || sectionOptions.length === 0}
                >
                  <option value="">{t("reportsReportPageShell.allSections")}</option>
                  {sectionOptions.map((s) => (
                    <option key={s} value={s}>{t("reportsReportPageShell.section")} {s}</option>
                  ))}
                </Select>
              </FilterField>
            )}
            {wantsVillage && (
              <FilterField label={FILTER_LABELS.village} icon={FILTER_ICONS.village}>
                <Select value={filters.village ?? ""} onChange={(e) => setFilter("village", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.all")}</option>
                  {villages.map((v) => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                  <option value={NONE_RECORDED}>(No village recorded)</option>
                </Select>
              </FilterField>
            )}
            {/* A school that never records districts has no list to offer. */}
            {wantsDistrict && districts.length > 0 && (
              <FilterField label={FILTER_LABELS.district} icon={FILTER_ICONS.district}>
                <Select value={filters.district ?? ""} onChange={(e) => setFilter("district", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.all")}</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                  <option value={NONE_RECORDED}>(No district recorded)</option>
                </Select>
              </FilterField>
            )}
            {report.filters.includes("gender") && (
              <FilterField label={FILTER_LABELS.gender} icon={FILTER_ICONS.gender}>
                <Select value={filters.gender ?? ""} onChange={(e) => setFilter("gender", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.all")}</option>
                  <option value="MALE">{t("reportsReportPageShell.male")}</option>
                  <option value="FEMALE">{t("reportsReportPageShell.female")}</option>
                </Select>
              </FilterField>
            )}
            {report.filters.includes("status") && (
              <FilterField label={FILTER_LABELS.status} icon={FILTER_ICONS.status}>
                <Select value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.all")}</option>
                  {statusOptionsFor(categoryId, report.slug).map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(`reportsReportPageShell.${o.labelKey}` as TranslationKey)}
                    </option>
                  ))}
                </Select>
              </FilterField>
            )}
            {report.filters.includes("shift") && (
              <FilterField label={FILTER_LABELS.shift} icon={FILTER_ICONS.shift}>
                <Select value={filters.shift ?? ""} onChange={(e) => setFilter("shift", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.allShifts")}</option>
                  {shiftOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FilterField>
            )}
            {report.filters.includes("examId") && (
              <FilterField label={FILTER_LABELS.examId} icon={FILTER_ICONS.examId}>
                <Select value={filters.examId ?? ""} onChange={(e) => setFilter("examId", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.allExams")}</option>
                  {exams.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </Select>
              </FilterField>
            )}
            {report.filters.includes("month") && (
              <FilterField label={FILTER_LABELS.month}>
                <input
                  type="month"
                  value={filters.month ?? ""}
                  min={period?.firstMonth ?? undefined}
                  max={period?.lastMonth}
                  onChange={(e) => setFilter("month", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {period?.firstMonth && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Records run from {period.firstMonth} to {period.lastMonth}.
                  </p>
                )}
              </FilterField>
            )}
            {report.filters.includes("date") && (
              <FilterField label={FILTER_LABELS.date}>
                <input
                  type="date"
                  value={filters.date ?? ""}
                  min={period?.firstDate ?? undefined}
                  max={period?.lastDate}
                  onChange={(e) => setFilter("date", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </FilterField>
            )}
            {report.filters.includes("dateFrom") && (
              <FilterField label={FILTER_LABELS.dateFrom}>
                <input
                  type="date"
                  value={filters.dateFrom ?? ""}
                  min={period?.firstDate ?? undefined}
                  max={period?.lastDate}
                  onChange={(e) => setFilter("dateFrom", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </FilterField>
            )}
            {report.filters.includes("dateTo") && (
              <FilterField label={FILTER_LABELS.dateTo}>
                <input
                  type="date"
                  value={filters.dateTo ?? ""}
                  min={period?.firstDate ?? undefined}
                  max={period?.lastDate}
                  onChange={(e) => setFilter("dateTo", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </FilterField>
            )}
            {(search || Object.values(filters).some(Boolean)) && (
              <div className="flex items-end">
                <Button variant="ghost" onClick={() => { setSearch(""); setFilters({}); }}>
                  <X className="me-1 h-4 w-4" /> {t("reportsReportPageShell.clear")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {report.chart && !dataLoading && (
        <ReportBarChart
          rows={data.rows}
          xKey={report.chart.xKey}
          yKey={report.chart.yKey}
          label={report.chart.label}
        />
      )}

      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[600px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b bg-muted/70 text-xs font-semibold text-foreground/80 backdrop-blur">
              <tr>
                <th className="w-12 px-4 py-3 text-start align-middle font-semibold">#</th>
                {visibleColumns.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "whitespace-nowrap px-4 py-3 align-middle font-semibold",
                      c.align === "right" ? "text-end" : c.align === "center" ? "text-center" : "text-start",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.label}
                      <ArrowDownUp className={cn("h-3 w-3", sortKey === c.key ? "text-primary opacity-100" : "opacity-40")} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requiresManualLoad && !hasLoaded ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                    Set your filters, then press Load Report.
                  </td>
                </tr>
              ) : dataLoading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                    {t("reportsReportPageShell.loadingReportData")}
                  </td>
                </tr>
              ) : awaitingInput ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-4 py-16 text-center">
                    <p className="font-medium">
                      {prompt ? `${prompt.label} ${prompt.value}` : "Set the filters above to run this report."}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Nothing is missing from the school&apos;s records — this
                      report needs a selection before it can run.
                    </p>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                    {t("reportsReportPageShell.noRecordsMatchYourFilters")}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => (
                  <tr key={i} className="border-t transition-colors even:bg-muted/20 hover:bg-primary/5">
                    <td className="px-4 py-2.5 text-start align-middle tabular-nums text-muted-foreground">
                      {(currentPage - 1) * pageSize + i + 1}
                    </td>
                    {visibleColumns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-4 py-2.5 align-middle",
                          c.align === "right"
                            ? "whitespace-nowrap text-end tabular-nums"
                            : c.align === "center"
                              ? "text-center"
                              : "text-start",
                        )}
                      >
                        <ReportCell value={row[c.key]} column={c} isPerson={c.key === personKey} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3">
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            total={sorted.length}
            pageSize={pageSize}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            onPageChange={setPage}
          />
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {t("reportsReportPageShell.readOnlyReport")} {sorted.length} {t("reportsReportPageShell.totalRecordSGenerated")} {new Date().toLocaleString()}
      </p>

      {/* ── The document itself, before it is printed ───────────────── */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${report.title} \u2014 preview`}
        description={`${sorted.length} record(s) \u00b7 ${visibleColumns.length} of ${data.columns.length} fields \u00b7 exactly what will print`}
        className="max-w-5xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <ExportMenu onPick={(f) => void handleExport(f)} disabled={exporting !== null} />
            <Button onClick={handlePrint}>
              <Printer className="me-2 h-4 w-4" /> {t("reportsReportPageShell.print")}
            </Button>
          </div>
        }
      >
        {/* An iframe, because the sheet carries its own page styles and must
            not inherit the app's — a preview that renders differently from
            the printout is worse than no preview. */}
        <iframe
          title="Report preview"
          srcDoc={previewHtml}
          className="h-[65vh] w-full rounded-lg border bg-white"
        />
      </Dialog>
    </div>
  );
}
