"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  ArrowLeft,
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
import { activeAcademicYear, classNamesForYear, getAcademicsState, sectionNamesForClass, useAcademicsState } from "@/lib/academics/store";
import { api } from "@/lib/api";
import { logReportAction } from "@/lib/reports/audit";
import { fetchReport, fetchReportAsync } from "@/lib/reports/data";
import { downloadReportPdf, exportReportCsv, printReport } from "@/lib/reports/print";
import type { ReportDef, ReportFilterKey, ReportFilters } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 15;

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

export function ReportPageShell({ categoryId, categoryLabel, report }: Props) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
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
  const sectionOptions = useMemo(
    () =>
      filters.className
        ? sectionNamesForClass(filters.className, reportYear)
        : [],
    [filters.className, reportYear, academics.sections],
  );

  useEffect(() => setMounted(true), []);

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

  useEffect(() => {
    if (!mounted) return;
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
  }, [mounted, categoryId, report.slug, filters, search, refreshKey, needsAsync]);

  const sorted = useMemo(() => {
    if (!sortKey) return data.rows;
    return [...data.rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data.rows, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

  function handlePrint() {
    printReport({ title: report.title, academicYear: filters.academicYear ?? year, data: { ...data, rows: sorted } });
    logReportAction(categoryLabel, report.title, "PRINTED");
    toast("Opening print preview…", "info");
  }

  function handlePdf() {
    downloadReportPdf({ title: report.title, academicYear: filters.academicYear ?? year, data: { ...data, rows: sorted } });
    logReportAction(categoryLabel, report.title, "PDF_DOWNLOADED");
    toast("Use Save as PDF in the print dialog.", "info");
  }

  function handleCsv() {
    exportReportCsv(report.title, data.columns, sorted);
    logReportAction(categoryLabel, report.title, "CSV_EXPORTED");
    toast(`Exported ${sorted.length} rows.`, "success");
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading report…
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
        <ArrowLeft className="h-4 w-4" /> Back to {categoryLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{report.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Academic Year: <span className="font-medium text-foreground">{filters.academicYear ?? year}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" onClick={handlePdf}>
            <FileDown className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={handleCsv}>
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search report…"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
          <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {showFilters && report.filters.length > 0 && (
          <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {report.filters.includes("academicYear") && (
              <div>
                <Label>{FILTER_LABELS.academicYear}</Label>
                <Select value={filters.academicYear ?? ""} onChange={(e) => setFilter("academicYear", e.target.value)}>
                  <option value="">Current ({year})</option>
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
                  <option value="">All Classes</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
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
                  <option value="">All Sections</option>
                  {sectionOptions.map((s) => (
                    <option key={s} value={s}>Section {s}</option>
                  ))}
                </Select>
              </div>
            )}
            {report.filters.includes("gender") && (
              <div>
                <Label>{FILTER_LABELS.gender}</Label>
                <Select value={filters.gender ?? ""} onChange={(e) => setFilter("gender", e.target.value)}>
                  <option value="">All</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </Select>
              </div>
            )}
            {report.filters.includes("status") && (
              <div>
                <Label>{FILTER_LABELS.status}</Label>
                <Select value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
                  <option value="">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="GRADUATED">Graduated</option>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                </Select>
              </div>
            )}
            {report.filters.includes("shift") && (
              <div>
                <Label>{FILTER_LABELS.shift}</Label>
                <Select value={filters.shift ?? ""} onChange={(e) => setFilter("shift", e.target.value)}>
                  <option value="">All Shifts</option>
                  <option value="MORNING">Morning</option>
                  <option value="AFTERNOON">Afternoon</option>
                </Select>
              </div>
            )}
            {report.filters.includes("examId") && (
              <div>
                <Label>{FILTER_LABELS.examId}</Label>
                <Select value={filters.examId ?? ""} onChange={(e) => setFilter("examId", e.target.value)}>
                  <option value="">All Exams</option>
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
                  onChange={(e) => setFilter("month", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
            {report.filters.includes("date") && (
              <div>
                <Label>{FILTER_LABELS.date}</Label>
                <input
                  type="date"
                  value={filters.date ?? ""}
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
                  onChange={(e) => setFilter("dateTo", e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
            {(search || Object.values(filters).some(Boolean)) && (
              <div className="flex items-end">
                <Button variant="ghost" onClick={() => { setSearch(""); setFilters({}); }}>
                  <X className="mr-1 h-4 w-4" /> Clear
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

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[560px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                {data.columns.map((c) => (
                  <th key={c.key} className={cn("px-4 py-3 font-medium", c.align === "right" && "text-right")}>
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
              {dataLoading ? (
                <tr>
                  <td colSpan={data.columns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                    Loading report data…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={data.columns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                    No records match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => (
                  <tr key={i} className="border-t hover:bg-secondary/40">
                    <td className="px-4 py-3 text-muted-foreground">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    {data.columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-4 py-3",
                          c.align === "right" && "text-right tabular-nums",
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
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Read-only report · {sorted.length} total record(s) · Generated {new Date().toLocaleString()}
      </p>
    </div>
  );
}
