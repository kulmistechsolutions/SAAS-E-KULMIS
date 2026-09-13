"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  Loader2,
  Plus,
  Printer,
  Save,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  activeAcademicYear,
  classByName,
  groupClassesByStructure,
  sectionsForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { refreshStudents, useStudentsState } from "@/lib/students/store";
import {
  apiCreateStudentCase,
  apiListStudentCases,
  apiStudentCasesDashboard,
  apiStudentCasesForStudent,
} from "@/lib/student-cases/api";
import {
  printStudentCaseFile,
  printStudentCases,
} from "@/lib/student-cases/print";
import type {
  StudentCaseDashboard,
  StudentCaseRecord,
} from "@/lib/student-cases/types";
import { toast } from "@/lib/toast";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

/**
 * Student Cases.
 *
 * The page used to open on the empty form, so the first thing anyone saw was
 * a blank sheet asking them to type — never what the school's discipline
 * record actually says. It opens on the dashboard now; recording a case is
 * one click away and reading the situation is none.
 *
 * The tabs sit above the panel rather than inside it, so the heading, the
 * tabs and the content read top to bottom instead of the tabs floating in the
 * middle of a card.
 */

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: AlertTriangle },
  { id: "reports", label: "Case Records", icon: FileText },
  { id: "add", label: "Add Case", icon: Plus },
];

const EMPTY_DASHBOARD: StudentCaseDashboard = {
  total: 0,
  thisMonth: 0,
  thisWeek: 0,
  studentsInvolved: 0,
  topStudents: [],
  byClass: [],
  recent: [],
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentCasesPage() {
  const t = useT();
  const mounted = useHydrated();
  useEffect(() => {
    void refreshStudents();
  }, []);

  const academics = useAcademicsState();
  const studentsState = useStudentsState();
  const [tab, setTab] = useState("dashboard");

  const [year, setYear] = useState("");
  useEffect(() => {
    if (!year && academics.academicYears.length) {
      setYear(activeAcademicYear() || academics.academicYears[0]?.name || "");
    }
  }, [academics.academicYears, year]);

  const yearClasses = useMemo(
    () => academics.classes.filter((c) => c.academicYear === year),
    [academics.classes, year],
  );
  const yearClassGroups = useMemo(
    () =>
      groupClassesByStructure(
        yearClasses,
        (c) => c.name,
        year,
        t("common.defaultGrades"),
      ),
    [yearClasses, year, academics.structureTrees, t],
  );

  function renderClassOptions() {
    return yearClassGroups.map((g) =>
      g.label === null ? (
        g.items.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))
      ) : (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ),
    );
  }

  /**
   * One student's whole file, on school paper.
   *
   * A case belongs to a child, not to a day — so wherever a child's name
   * appears the printer is on it, and what comes out is every case ever
   * recorded for that child with the description in full. That is the
   * document a parent is shown in a meeting.
   */
  const printFile = useCallback(
    async (studentId: string, code: string, name: string) => {
      try {
        const rows = await apiStudentCasesForStudent(studentId);
        if (rows.length === 0) {
          toast("This student has no recorded cases.", "error");
          return;
        }
        const st = studentsState.students.find((s) => s.id === studentId);
        printStudentCaseFile({
          student: {
            code: code || st?.code || "",
            name: name || st?.fullName || "",
            className: st?.className ?? undefined,
            section: st?.section ?? undefined,
            academicYear: st?.academicYear ?? undefined,
          },
          rows,
        });
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Could not load the student's cases.",
          "error",
        );
      }
    },
    [studentsState.students],
  );

  // ── Add Case ──────────────────────────────────────────────────────────
  const [fClass, setFClass] = useState("");
  const [fSection, setFSection] = useState("");
  const [fStudentId, setFStudentId] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fNote, setFNote] = useState("");
  const [fDate, setFDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const fSelectedClass = useMemo(() => classByName(fClass, year), [fClass, year]);
  const fNeedsSection = fSelectedClass?.hasSections ?? true;
  const fSectionOptions = useMemo(
    () => (fSelectedClass ? sectionsForClass(fSelectedClass.id) : []),
    [fSelectedClass, academics.sections],
  );

  const fStudentOptions = useMemo(() => {
    return studentsState.students.filter(
      (s) =>
        s.status === "ACTIVE" &&
        s.academicYear === year &&
        s.className === fClass &&
        (!fNeedsSection || !fSection || s.section === fSection),
    );
  }, [studentsState.students, year, fClass, fSection, fNeedsSection]);

  async function handleCreateCase() {
    if (!fClass) return toast("Select a class.", "error");
    if (fNeedsSection && !fSection) return toast("Select a section.", "error");
    if (!fStudentId) return toast("Select a student.", "error");
    if (!fTitle.trim()) return toast("Enter a case title.", "error");
    if (!fSelectedClass) return toast("Select a class.", "error");
    const section = fSectionOptions.find((s) => s.name === fSection);
    setSaving(true);
    try {
      await apiCreateStudentCase({
        studentId: fStudentId,
        classId: fSelectedClass.id,
        sectionId: section?.id ?? null,
        title: fTitle.trim(),
        note: fNote.trim() || null,
        date: fDate,
      });
      toast("Case recorded.");
      setFStudentId("");
      setFTitle("");
      setFNote("");
      // The figures behind the tabs are now out of date; refresh them rather
      // than showing a dashboard that has not heard about what was just typed.
      void loadDashboard();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to record case.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Dashboard ─────────────────────────────────────────────────────────
  const [dashboard, setDashboard] = useState<StudentCaseDashboard>(EMPTY_DASHBOARD);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      setDashboard(await apiStudentCasesDashboard());
    } catch {
      setDashboard(EMPTY_DASHBOARD);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void loadDashboard();
  }, [mounted, loadDashboard]);

  // ── Case records ──────────────────────────────────────────────────────
  const [rClass, setRClass] = useState("");
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");
  const [rSearch, setRSearch] = useState("");
  const [rRows, setRRows] = useState<StudentCaseRecord[]>([]);
  const [rLoading, setRLoading] = useState(false);

  const loadReport = useCallback(async () => {
    const cls = rClass ? classByName(rClass, year) : null;
    setRLoading(true);
    try {
      setRRows(
        await apiListStudentCases({
          classId: cls?.id,
          dateFrom: rFrom || undefined,
          dateTo: rTo || undefined,
        }),
      );
    } catch {
      setRRows([]);
    } finally {
      setRLoading(false);
    }
  }, [rClass, rFrom, rTo, year]);

  useEffect(() => {
    if (tab !== "reports" || !mounted) return;
    void loadReport();
  }, [tab, mounted, loadReport]);

  /** Searching the loaded page is instant; asking the server again is not. */
  const rVisible = useMemo(() => {
    const q = rSearch.trim().toLowerCase();
    if (!q) return rRows;
    return rRows.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.studentCode.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q),
    );
  }, [rRows, rSearch]);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("attendanceStudents.loading")}
      </div>
    );
  }

  const maxClassCount = Math.max(1, ...dashboard.byClass.map((c) => c.count));

  return (
    <div className="space-y-6">
      {/* ── Heading ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            {t("studentCases.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("studentCases.description")}
          </p>
        </div>
        {tab !== "add" && (
          <Button className="h-9" onClick={() => setTab("add")}>
            <Plus className="me-2 h-4 w-4" /> {t("studentCases.saveCase")}
          </Button>
        )}
      </div>

      {/* ── Tabs, above the panel rather than inside it ────────────────── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium shadow-sm transition-all",
              tab === x.id
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "bg-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
            )}
          >
            <x.icon className="h-4 w-4" />
            {x.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard ──────────────────────────────────────────────────── */}
      {tab === "dashboard" &&
        (dashboardLoading ? (
          <div className="flex h-56 items-center justify-center text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("attendanceStudents.loadingDashboard")}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi
                label={t("studentCases.totalCases")}
                value={dashboard.total}
                note="All cases ever recorded"
                icon={AlertTriangle}
                chip="bg-rose-500/15 text-rose-600 dark:text-rose-400"
              />
              <Kpi
                label="This month"
                value={dashboard.thisMonth}
                note="Dated in the current month"
                icon={CalendarDays}
                chip="bg-amber-500/15 text-amber-600 dark:text-amber-400"
              />
              <Kpi
                label="Last 7 days"
                value={dashboard.thisWeek}
                note="Today included"
                icon={CalendarDays}
                chip="bg-sky-500/15 text-sky-600 dark:text-sky-400"
              />
              <Kpi
                label="Students involved"
                value={dashboard.studentsInvolved}
                note="Children, not cases"
                icon={Users}
                chip="bg-violet-500/15 text-violet-600 dark:text-violet-400"
              />
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-2">
              {/* Most recorded — each name prints its own file. */}
              <Panel
                title={t("studentCases.topStudents")}
                note="Print a student to get their full case file"
              >
                {dashboard.topStudents.length === 0 ? (
                  <Empty>{t("studentCases.noCasesYet")}</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2.5 text-start font-medium">
                            {t("attendanceStudents.studentId")}
                          </th>
                          <th className="px-4 py-2.5 text-start font-medium">
                            {t("attendanceStudents.name")}
                          </th>
                          <th className="px-4 py-2.5 text-start font-medium">
                            {t("attendanceStudents.class")}
                          </th>
                          <th className="px-4 py-2.5 text-end font-medium">
                            {t("studentCases.cases")}
                          </th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.topStudents.map((s) => (
                          <tr key={s.studentId} className="border-t">
                            <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                              {s.studentCode}
                            </td>
                            <td className="px-4 py-2.5 font-medium">{s.studentName}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                              {s.className || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-end">
                              <span className="inline-flex min-w-[26px] justify-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                                {s.count}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-end">
                              <button
                                title="Print this student's case file"
                                onClick={() =>
                                  void printFile(s.studentId, s.studentCode, s.studentName)
                                }
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Cases by class" note="Where the notes are coming from">
                {dashboard.byClass.length === 0 ? (
                  <Empty>{t("studentCases.noCasesYet")}</Empty>
                ) : (
                  <ul className="space-y-3 p-5">
                    {dashboard.byClass.map((c) => (
                      <li key={c.classId}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium">
                            {c.className || "—"}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {c.count}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{
                              width: `${Math.round((c.count / maxClassCount) * 100)}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <Panel title="Latest cases" note="The eight most recent, newest first">
              {dashboard.recent.length === 0 ? (
                <Empty>{t("studentCases.noCasesYet")}</Empty>
              ) : (
                <ul className="divide-y">
                  {dashboard.recent.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-medium">{c.studentName}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {c.studentCode}
                          </span>
                          {c.className && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                              {c.className}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm">{c.title}</p>
                        {c.note && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {c.note}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                          {c.date}
                        </span>
                        <button
                          title="Print this student's case file"
                          onClick={() =>
                            void printFile(c.studentId, c.studentCode, c.studentName)
                          }
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        ))}

      {/* ── Case records ───────────────────────────────────────────────── */}
      {tab === "reports" && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label={t("attendanceStudents.class")}>
                <Select value={rClass} onChange={(e) => setRClass(e.target.value)}>
                  <option value="">{t("attendanceStudents.allClasses")}</option>
                  {renderClassOptions()}
                </Select>
              </Field>
              <Field label="From">
                <input
                  type="date"
                  value={rFrom}
                  onChange={(e) => setRFrom(e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  value={rTo}
                  onChange={(e) => setRTo(e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label="Search">
                <input
                  value={rSearch}
                  onChange={(e) => setRSearch(e.target.value)}
                  placeholder="Name, ID or case"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Button
                variant="outline"
                className="h-10"
                onClick={() => {
                  if (rVisible.length === 0)
                    return toast("No cases to print.", "error");
                  printStudentCases({
                    scope: [
                      { label: "Academic Year", value: year },
                      {
                        label: "Class",
                        value: rClass || t("attendanceStudents.allClasses"),
                      },
                      { label: "From", value: rFrom || "Earliest" },
                      { label: "To", value: rTo || "Latest" },
                      { label: "Search", value: rSearch.trim() },
                    ],
                    rows: rVisible,
                  });
                }}
              >
                <Printer className="me-2 h-4 w-4" /> {t("attendanceStudents.print")}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
              <h2 className="font-semibold">Case records</h2>
              <span className="text-xs text-muted-foreground">
                {rVisible.length}{" "}
                {rVisible.length === 1 ? "case" : "cases"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t("attendanceStudents.studentId")}
                    </th>
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t("attendanceStudents.student")}
                    </th>
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t("studentCases.caseTitle")}
                    </th>
                    <th className="px-4 py-2.5 text-start font-medium">Description</th>
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t("studentCases.date")}
                    </th>
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t("printHistory.printedBy")}
                    </th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        <Loader2 className="me-2 inline h-4 w-4 animate-spin" />
                        {t("attendanceStudents.loadingRecords")}
                      </td>
                    </tr>
                  ) : rVisible.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        {t("studentCases.noCasesYet")}
                      </td>
                    </tr>
                  ) : (
                    rVisible.map((r) => (
                      <tr key={r.id} className="border-t align-top">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                          {r.studentCode}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{r.studentName}</td>
                        <td className="px-4 py-2.5">{r.title}</td>
                        <td className="max-w-[280px] px-4 py-2.5 text-muted-foreground">
                          {r.note ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                          {r.date}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                          {r.recordedByUsername ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-end">
                          <button
                            title="Print this student's case file"
                            onClick={() =>
                              void printFile(r.studentId, r.studentCode, r.studentName)
                            }
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Case ───────────────────────────────────────────────────── */}
      {tab === "add" && (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border bg-card shadow-sm lg:col-span-2">
            <div className="border-b px-5 py-3">
              <h2 className="font-semibold">Record a case</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Who it concerns, what happened, and when.
              </p>
            </div>

            <div className="space-y-5 p-5">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Student
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label={t("attendanceStudents.academicYear")}>
                    <Select
                      value={year}
                      onChange={(e) => {
                        setYear(e.target.value);
                        setFClass("");
                        setFSection("");
                        setFStudentId("");
                      }}
                    >
                      {academics.academicYears.map((y) => (
                        <option key={y.id} value={y.name}>
                          {y.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("studentCases.date")}>
                    <input
                      type="date"
                      value={fDate}
                      onChange={(e) => setFDate(e.target.value)}
                      className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </Field>
                  <Field label={t("attendanceStudents.class")}>
                    <Select
                      value={fClass}
                      onChange={(e) => {
                        setFClass(e.target.value);
                        setFSection("");
                        setFStudentId("");
                      }}
                    >
                      <option value="">{t("attendanceStudents.selectClass")}</option>
                      {renderClassOptions()}
                    </Select>
                  </Field>
                  <Field
                    label={`${t("attendanceStudents.section")}${fNeedsSection ? " *" : ""}`}
                  >
                    <Select
                      value={fSection}
                      onChange={(e) => {
                        setFSection(e.target.value);
                        setFStudentId("");
                      }}
                      disabled={!fNeedsSection}
                    >
                      <option value="">
                        {fNeedsSection ? t("studentCases.selectSection") : "—"}
                      </option>
                      {fSectionOptions.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label={t("studentCases.student")}>
                      <Select
                        value={fStudentId}
                        onChange={(e) => setFStudentId(e.target.value)}
                      >
                        <option value="">{t("studentCases.selectStudent")}</option>
                        {fStudentOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.fullName}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {fClass && fStudentOptions.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        No active students in this selection for {year}.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  The case
                </h3>
                <div className="mt-3 space-y-3">
                  <Field label={t("studentCases.caseTitle")}>
                    <input
                      value={fTitle}
                      onChange={(e) => setFTitle(e.target.value)}
                      placeholder={t("studentCases.caseTitlePlaceholder")}
                      className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                  </Field>
                  <Field label="Case description">
                    <Textarea
                      value={fNote}
                      onChange={(e) => setFNote(e.target.value)}
                      rows={5}
                      placeholder="What happened, what was done about it, and who was told."
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      This is what prints on the student&apos;s case file, in full.
                    </p>
                  </Field>
                </div>
              </section>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button onClick={() => void handleCreateCase()} disabled={saving}>
                  {saving ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="me-2 h-4 w-4" />
                  )}
                  {t("studentCases.saveCase")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFTitle("");
                    setFNote("");
                    setFStudentId("");
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {/* What is about to be written down, before it is. */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Preview</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Exactly what will be saved.
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Student">
                {fStudentOptions.find((s) => s.id === fStudentId)?.fullName ?? "—"}
              </Row>
              <Row label="Class">
                {fClass ? `${fClass}${fSection ? ` · ${fSection}` : ""}` : "—"}
              </Row>
              <Row label="Date">{fDate || "—"}</Row>
              <Row label="Case">{fTitle.trim() || "—"}</Row>
              <div>
                <dt className="text-xs text-muted-foreground">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-lg border bg-background/40 p-3 text-xs leading-relaxed">
                  {fNote.trim() || "No description."}
                </dd>
              </div>
            </dl>

            {fStudentId && (
              <button
                onClick={() => {
                  const st = fStudentOptions.find((s) => s.id === fStudentId);
                  if (st) void printFile(st.id, st.code, st.fullName);
                }}
                className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline"
              >
                <Printer className="h-3.5 w-3.5" />
                Print this student&apos;s existing file
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  icon: Icon,
  chip,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof AlertTriangle;
  chip: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          chip,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-3xl font-bold leading-none tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="mt-1.5 truncate text-sm font-medium">{label}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-end font-medium">{children}</dd>
    </div>
  );
}
