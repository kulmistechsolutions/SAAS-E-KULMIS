"use client";


import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  ArrowLeft,
  Columns3,
  Eye,
  FileDown,
  Printer,
  RefreshCw,
  Search,
  X,
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
  downloadReportPdf,
  exportReportCsv,
  printReport,
  reportDocumentHtml,
} from "@/lib/reports/print";
import { Dialog } from "@/components/ui/dialog";
import { useShifts } from "@/lib/teachers/shifts";
import { ReportBarChart } from "./report-chart";
import type { ReportDef, ReportFilterKey, ReportFilters } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useHydrated } from "@/lib/use-hydrated";


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
};

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
          value: String(filters[k as ReportFilterKey]),
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

  function handlePdf() {
    downloadReportPdf(documentOptions);
    logReportAction(categoryLabel, report.title, "PDF_DOWNLOADED");
    toast("Use Save as PDF in the print dialog.", "info");
  }

  function handleCsv() {
    exportReportCsv(report.title, visibleColumns, sorted);
    logReportAction(categoryLabel, report.title, "CSV_EXPORTED");
    toast(`Exported ${sorted.length} rows.`, "success");
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("reportsReportPageShell.loadingReport")}
      </div>
    );
  }

  const years = getAcademicsState().academicYears;

  return (
    <div className="space-y-6">
      <Link
        href={`/reports/${categoryId}`}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {t("reportsReportPageShell.backTo")} {categoryLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{report.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("reportsReportPageShell.academicYear")} <span className="font-medium text-foreground">{filters.academicYear ?? year}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPreviewOpen(true)} disabled={!hasDocument}>
            <Eye className="me-2 h-4 w-4" /> Preview
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!hasDocument}>
            <Printer className="me-2 h-4 w-4" /> {t("reportsReportPageShell.print")}
          </Button>
          <Button variant="outline" onClick={handlePdf} disabled={!hasDocument}>
            <FileDown className="me-2 h-4 w-4" /> {t("reportsReportPageShell.pdf")}
          </Button>
          <Button variant="outline" onClick={handleCsv} disabled={!hasDocument}>
            <FileDown className="me-2 h-4 w-4" /> {t("reportsReportPageShell.csv")}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("reportsReportPageShell.searchReport")}
              className="h-10 w-full rounded-lg border bg-background ps-9 pe-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
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

        {showFilters && report.filters.length > 0 && (
          <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {report.filters.includes("academicYear") && (
              <div>
                <Label>{FILTER_LABELS.academicYear}</Label>
                <Select value={filters.academicYear ?? ""} onChange={(e) => setFilter("academicYear", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.current")}{year})</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.name}>{y.name}</option>
                  ))}
                </Select>
              </div>
            )}
            {report.filters.includes("className") && (
              <div>
                <Label>{FILTER_LABELS.className}</Label>
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
              </div>
            )}
            {report.filters.includes("section") && (
              <div>
                <Label>{FILTER_LABELS.section}</Label>
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
              </div>
            )}
            {report.filters.includes("gender") && (
              <div>
                <Label>{FILTER_LABELS.gender}</Label>
                <Select value={filters.gender ?? ""} onChange={(e) => setFilter("gender", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.all")}</option>
                  <option value="MALE">{t("reportsReportPageShell.male")}</option>
                  <option value="FEMALE">{t("reportsReportPageShell.female")}</option>
                </Select>
              </div>
            )}
            {report.filters.includes("status") && (
              <div>
                <Label>{FILTER_LABELS.status}</Label>
                <Select value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.all")}</option>
                  {statusOptionsFor(categoryId, report.slug).map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(`reportsReportPageShell.${o.labelKey}` as TranslationKey)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {report.filters.includes("shift") && (
              <div>
                <Label>{FILTER_LABELS.shift}</Label>
                <Select value={filters.shift ?? ""} onChange={(e) => setFilter("shift", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.allShifts")}</option>
                  {shiftOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {report.filters.includes("examId") && (
              <div>
                <Label>{FILTER_LABELS.examId}</Label>
                <Select value={filters.examId ?? ""} onChange={(e) => setFilter("examId", e.target.value)}>
                  <option value="">{t("reportsReportPageShell.allExams")}</option>
                  {exams.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </Select>
              </div>
            )}
            {report.filters.includes("month") && (
              <div>
                <Label>{FILTER_LABELS.month}</Label>
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
              </div>
            )}
            {report.filters.includes("date") && (
              <div>
                <Label>{FILTER_LABELS.date}</Label>
                <input
                  type="date"
                  value={filters.date ?? ""}
                  min={period?.firstDate ?? undefined}
                  max={period?.lastDate}
                  onChange={(e) => setFilter("date", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
            {report.filters.includes("dateFrom") && (
              <div>
                <Label>{FILTER_LABELS.dateFrom}</Label>
                <input
                  type="date"
                  value={filters.dateFrom ?? ""}
                  min={period?.firstDate ?? undefined}
                  max={period?.lastDate}
                  onChange={(e) => setFilter("dateFrom", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
            {report.filters.includes("dateTo") && (
              <div>
                <Label>{FILTER_LABELS.dateTo}</Label>
                <input
                  type="date"
                  value={filters.dateTo ?? ""}
                  min={period?.firstDate ?? undefined}
                  max={period?.lastDate}
                  onChange={(e) => setFilter("dateTo", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
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

      {data.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.summary.map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-lg font-bold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {report.chart && !dataLoading && (
        <ReportBarChart
          rows={data.rows}
          xKey={report.chart.xKey}
          yKey={report.chart.yKey}
          label={report.chart.label}
        />
      )}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[560px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-start text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                {visibleColumns.map((c) => (
                  <th key={c.key} className={cn("px-4 py-3 font-medium", c.align === "right" && "text-end")}>
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {c.label}
                      <ArrowDownUp className="h-3 w-3 opacity-50" />
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
                  <tr key={i} className="border-t hover:bg-secondary/40">
                    <td className="px-4 py-3 text-muted-foreground">{(currentPage - 1) * pageSize + i + 1}</td>
                    {visibleColumns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-4 py-3",
                          c.align === "right" && "text-end tabular-nums",
                          c.mono && "font-mono text-xs",
                        )}
                      >
                        {row[c.key] ?? "—"}
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
            <Button variant="outline" onClick={handleCsv}>
              <FileDown className="me-2 h-4 w-4" /> {t("reportsReportPageShell.csv")}
            </Button>
            <Button variant="outline" onClick={handlePdf}>
              <FileDown className="me-2 h-4 w-4" /> {t("reportsReportPageShell.pdf")}
            </Button>
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
