"use client";


import { useT } from "@/lib/i18n/provider";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCheck,
  Clock,
  FileDown,
  Loader2,
  Printer,
  Save,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { StudentStatusPicker } from "@/components/attendance/status-picker";
import { StudentAttendanceSummaryCards } from "@/components/attendance/summary-cards";
import {
  listAttendanceShifts,
  loadStudentMarkingRows,
  saveStudentAttendance,
  studentDashboardToday,
  useAttendanceState,
  type AttendanceSummary,
} from "@/lib/attendance/store";
import {
  apiStudentDailyAttendanceReport,
  type ApiAttendanceReportRow,
  type ApiShift,
} from "@/lib/attendance/api";
import {
  formatDisplayDate,
  studentStatusLabel,
  todayISO,
} from "@/lib/attendance/format";
import {
  exportStudentAttendanceCsv,
} from "@/lib/attendance/print";
import { printAttendanceReport } from "@/lib/attendance/report-print";
import {
  activeAcademicYear,
  classByName,
  groupClassesByStructure,
  sectionsForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { genderLabel } from "@/lib/students/format";
import type { StudentAttendanceStatus, StudentMarkRow } from "@/lib/attendance/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { loadTeacherMe } from "@/lib/teachers/session";
import type { TeacherMe } from "@/lib/teachers/api";
import { useHydrated } from "@/lib/use-hydrated";
import { MonthGrid } from "@/components/attendance/month-grid";
import {
  apiBackfillState,
  type ApiBackfillState,
} from "@/lib/attendance/api";

const TABS = [
  { id: "mark", label: "Mark Attendance" },
  { id: "dashboard", label: "Dashboard" },
  { id: "reports", label: "Reports" },
];

/** Months from "YYYY-MM" to "YYYY-MM", inclusive. */
function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  for (let i = 0; i < 36 && y && m; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= to) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function monthName(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
}

function StudentAttendanceScreen() {
  const t = useT();
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const mounted = useHydrated();
  const [teacherMe, setTeacherMe] = useState<TeacherMe | null>(null);

  useEffect(() => {
    if (!isTeacher) return;
    void loadTeacherMe()
      .then(setTeacherMe)
      .catch(() => toast("Could not load teacher assignments", "error"));
  }, [isTeacher]);

  useAttendanceState();
  const academics = useAcademicsState();
  const [tab, setTab] = useState("mark");

  const [year, setYear] = useState("");
  useEffect(() => {
    if (!year && academics.academicYears.length) {
      setYear(activeAcademicYear() || academics.academicYears[0]?.name || "");
    }
  }, [academics.academicYears, year]);

  const [date, setDate] = useState(todayISO());
  const [klass, setKlass] = useState("");
  const [section, setSection] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [shifts, setShifts] = useState<ApiShift[]>([]);

  // Arriving from "My Classes" with a specific register in mind. The pickers
  // below are keyed by name rather than id, so the ids in the link are
  // translated once the academic lists have loaded — and only once, or a
  // change of class would be dragged back to the link every render.
  const search = useSearchParams();
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current) return;
    const classId = search.get("classId");
    if (!classId || academics.classes.length === 0) return;
    const cls = academics.classes.find((c) => c.id === classId);
    if (!cls) return;
    deepLinked.current = true;
    setYear(cls.academicYear);
    setKlass(cls.name);
    const sectionId = search.get("sectionId");
    if (sectionId) {
      const sec = academics.sections.find((x) => x.id === sectionId);
      if (sec) setSection(sec.name);
    }
    const sid = search.get("shiftId");
    if (sid) setShiftId(sid);
    const d = search.get("date");
    if (d) setDate(d);
  }, [search, academics.classes, academics.sections]);

  // A school's attendance shifts, independent of academic year — schools
  // that never set any up simply get an empty list and the picker below
  // stays hidden, no forced complexity.
  useEffect(() => {
    void listAttendanceShifts().then(setShifts);
  }, []);

  // Catch-up marking. Null until the answer arrives; the tab is not offered
  // before then, because offering a window that turns out to be closed is
  // worse than showing it a moment late.
  const [backfill, setBackfill] = useState<ApiBackfillState | null>(null);
  const [catchMonth, setCatchMonth] = useState("");
  const [gridKey, setGridKey] = useState(0);

  useEffect(() => {
    void apiBackfillState()
      .then(setBackfill)
      .catch(() => setBackfill(null));
  }, []);

  const [rows, setRows] = useState<StudentMarkRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  // How much of this day was already on record when the register opened.
  const [markedCount, setMarkedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rSearch, setRSearch] = useState("");
  const [rDate, setRDate] = useState(todayISO());
  const [rClass, setRClass] = useState("");
  const [rSection, setRSection] = useState("");
  const [rStatus, setRStatus] = useState("");
  const [rShiftId, setRShiftId] = useState("");
  const [reportRows, setReportRows] = useState<ApiAttendanceReportRow[]>([]);
  const [reportSummary, setReportSummary] = useState<{ label: string; value: string }[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const [dashboard, setDashboard] = useState<
    AttendanceSummary & { totalStudents: number }
  >({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    percentage: 0,
    totalStudents: 0,
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const assignedClassNames = useMemo(() => {
    if (!isTeacher || !teacherMe) return null;
    return new Set(
      teacherMe.assignments
        .filter((a) => !year || a.academicYear.name === year)
        .map((a) => a.class.name),
    );
  }, [isTeacher, teacherMe, year]);

  const yearClasses = useMemo(() => {
    const all = academics.classes.filter((c) => c.academicYear === year);
    if (!assignedClassNames) return all;
    return all.filter((c) => assignedClassNames.has(c.name));
  }, [academics.classes, year, assignedClassNames]);
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

  const selectedMarkClass = useMemo(() => classByName(klass, year), [klass, year]);

  const sectionOptions = useMemo(() => {
    const cls = classByName(klass, year);
    const all = cls ? sectionsForClass(cls.id) : [];
    if (!isTeacher || !teacherMe || !klass) return all;
    const allowed = new Set(
      teacherMe.assignments
        .filter(
          (a) =>
            a.class.name === klass &&
            (!year || a.academicYear.name === year) &&
            a.section,
        )
        .map((a) => a.section!.name),
    );
    // null section assignment = all sections of that class
    const hasAllSections = teacherMe.assignments.some(
      (a) =>
        a.class.name === klass &&
        (!year || a.academicYear.name === year) &&
        a.sectionId === null,
    );
    if (hasAllSections) return all;
    return all.filter((s) => allowed.has(s.name));
  }, [klass, year, academics.sections, isTeacher, teacherMe]);

  // Ids for the catch-up grid, which asks the server about a month rather
  // than a day and so needs the class by id, not by the name in the picker.
  const markClassId = selectedMarkClass?.id ?? "";
  const markSectionId =
    sectionOptions.find((sec) => sec.name === section)?.id ?? null;

  // Which months catch-up marking is open over, and whether it is open at all.
  const catchUpOpen = backfill?.window?.open === true;
  const catchMonths = useMemo(
    () =>
      catchUpOpen && backfill?.window
        ? monthsBetween(
            backfill.window.from.slice(0, 7),
            backfill.window.to.slice(0, 7),
          )
        : [],
    [catchUpOpen, backfill],
  );

  useEffect(() => {
    if (catchMonths.length > 0 && !catchMonths.includes(catchMonth)) {
      setCatchMonth(catchMonths[0]!);
    }
  }, [catchMonths, catchMonth]);

  // A window that closes while somebody is standing in the tab must not leave
  // them on a screen that no longer exists.
  useEffect(() => {
    if (tab === "catchup" && !catchUpOpen) setTab("mark");
  }, [tab, catchUpOpen]);

  // A class flagged hasSections=true but with zero actual Section rows (e.g.
  // the toggle was left on at creation and no section was ever added) must
  // still be markable as a whole — otherwise the required Section field has
  // no options to satisfy itself with.
  const markClassNeedsSection =
    (selectedMarkClass?.hasSections ?? true) && sectionOptions.length > 0;

  useEffect(() => {
    if (tab !== "dashboard" || !mounted) return;
    if (isTeacher) {
      const cls = classByName(klass, year);
      if (!cls) {
        setDashboard({
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          percentage: 0,
          totalStudents: 0,
        });
        return;
      }
      const sec = sectionOptions.find((s) => s.name === section);
      setDashboardLoading(true);
      void studentDashboardToday(todayISO(), cls.id, sec?.id, shiftId || undefined)
        .then(setDashboard)
        .finally(() => setDashboardLoading(false));
      return;
    }
    setDashboardLoading(true);
    void studentDashboardToday(todayISO())
      .then(setDashboard)
      .finally(() => setDashboardLoading(false));
  }, [tab, mounted, isTeacher, klass, section, year, sectionOptions, shiftId]);

  useEffect(() => {
    if (tab !== "reports" || !mounted || !year) return;
    setReportLoading(true);
    void apiStudentDailyAttendanceReport({
      academicYear: year,
      date: rDate || undefined,
      className: rClass || undefined,
      section: rSection || undefined,
      status: rStatus || undefined,
      shiftId: rShiftId || undefined,
      search: rSearch || undefined,
    })
      .then((res) => {
        setReportRows(res.rows);
        setReportSummary(res.summary);
      })
      .catch(() => toast("Could not load report.", "error"))
      .finally(() => setReportLoading(false));
  }, [tab, mounted, year, rDate, rClass, rSection, rStatus, rShiftId, rSearch]);

  async function loadList() {
    if (!klass) return toast("Select a class.", "error");
    if (markClassNeedsSection && !section) return toast("Select a section.", "error");
    if (shifts.length > 0 && !shiftId) return toast("Select a shift.", "error");
    setLoading(true);
    const res = await loadStudentMarkingRows(year, klass, section, date, shiftId || null);
    setLoading(false);
    if (res.error) return toast(res.error, "error");
    setRows(res.rows);
    setMarkedCount(res.markedCount ?? 0);
    setLoaded(true);
  }

  function setRowStatus(id: string, status: StudentAttendanceStatus) {
    setRows((prev) => prev.map((r) => (r.studentId === id ? { ...r, status } : r)));
  }

  function markAll(status: StudentAttendanceStatus) {
    setRows((prev) =>
      prev.map((r) => (r.eligible ? { ...r, status } : r)),
    );
  }

  async function handleSave() {
    if (!loaded || !klass || (markClassNeedsSection && !section)) return;
    const eligible = rows.filter((r) => r.eligible);
    setSaving(true);
    const res = await saveStudentAttendance(
      year,
      klass,
      section,
      date,
      eligible.map((r) => ({ studentId: r.studentId, status: r.status })),
      shiftId || null,
    );
    setSaving(false);
    if (!res.ok) return toast(res.error ?? "Save failed.", "error");
    // The month grid is showing what is done and what is missing; this day
    // just changed sides.
    setGridKey((k) => k + 1);
    toast(
      `Attendance saved. ${res.summary?.present} present, ${res.summary?.absent} absent (${res.summary?.percentage}%).`,
    );
    // Said out loud rather than swallowed: this register already carried
    // somebody else's marks, and they have just been replaced.
    if (res.overwroteWorkOf && res.overwroteWorkOf.length > 0) {
      toast(
        `This register had already been taken by ${res.overwroteWorkOf.join(", ")}. Your marks have replaced theirs.`,
        "info",
      );
    }
  }

  const eligibleRows = rows.filter((r) => r.eligible);
  const previewSummary = {
    total: eligibleRows.length,
    present: eligibleRows.filter((r) => r.status === "PRESENT").length,
    absent: eligibleRows.filter((r) => r.status === "ABSENT").length,
    late: eligibleRows.filter((r) => r.status === "LATE").length,
    excused: eligibleRows.filter((r) => r.status === "EXCUSED").length,
    percentage:
      eligibleRows.length === 0
        ? 0
        : Math.round(
            ((eligibleRows.filter((r) => r.status === "PRESENT").length +
              eligibleRows.filter((r) => r.status === "LATE").length) /
              eligibleRows.length) *
              1000,
          ) / 10,
  };

  if (!mounted) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">{t("attendanceStudents.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      {!isTeacher && (
      <Link href="/attendance" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("attendanceStudents.backToAttendance")}
      </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("attendanceStudents.studentAttendance")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("attendanceStudents.recordAttendancePerClassAndSection")}
          </p>
        </div>
        {(user?.role === "ADMINISTRATOR" || user?.role === "ATTENDANCE_OFFICER") && (
          <Button variant="outline" asChild>
            <Link href="/attendance/shifts">
              <Clock className="me-2 h-4 w-4" /> {t("attendanceStudents.manageShifts")}
            </Link>
          </Button>
        )}
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <Tabs
          tabs={
            catchUpOpen
              ? [
                  TABS[0]!,
                  {
                    id: "catchup",
                    label: t("attendanceBackfill.tab"),
                  },
                  ...TABS.slice(1),
                ]
              : TABS
          }
          active={tab}
          onChange={setTab}
          className="px-2"
        />

        <div className="p-6">
          {tab === "catchup" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  {t("attendanceBackfill.openNow")
                    .replace("{from}", backfill?.window?.from ?? "")
                    .replace("{to}", backfill?.window?.to ?? "")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("attendanceBackfill.tabHelp")}
                </p>
              </div>

              <div className={cn(
                "grid gap-3 rounded-xl border bg-secondary/20 p-4 sm:grid-cols-2",
                shifts.length > 0 ? "lg:grid-cols-4" : "lg:grid-cols-3",
              )}>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("attendanceBackfill.month")}
                  </label>
                  <Select
                    value={catchMonth}
                    onChange={(e) => setCatchMonth(e.target.value)}
                  >
                    {catchMonths.map((m) => (
                      <option key={m} value={m}>
                        {monthName(m)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("attendanceStudents.class")}
                  </label>
                  <Select value={klass} onChange={(e) => { setKlass(e.target.value); setSection(""); setLoaded(false); }}>
                    <option value="">{t("attendanceStudents.selectClass")}</option>
                    {yearClassGroups.map((g) =>
                      g.label === null ? (
                        g.items.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))
                      ) : (
                        <optgroup key={g.label} label={g.label}>
                          {g.items.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </optgroup>
                      ),
                    )}
                  </Select>
                </div>
                {sectionOptions.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("attendanceStudents.section")}
                    </label>
                    <Select value={section} onChange={(e) => { setSection(e.target.value); setLoaded(false); }}>
                      <option value="">
                        {markClassNeedsSection ? "Select section" : "— (no sections)"}
                      </option>
                      {sectionOptions.map((sec) => (
                        <option key={sec.id} value={sec.name}>
                          {t("attendanceStudents.section")} {sec.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                {shifts.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("attendanceStudents.shift")} *
                    </label>
                    <Select value={shiftId} onChange={(e) => { setShiftId(e.target.value); setLoaded(false); }}>
                      <option value="">{t("attendanceStudents.selectShift")}</option>
                      {shifts.map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          {sh.status === "ACTIVE"
                            ? sh.name
                            : `${sh.name} (${t("attendanceShifts.retired")})`}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              {!markClassId || (shifts.length > 0 && !shiftId) ? (
                <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                  {t("attendanceBackfill.pickClass")}
                </p>
              ) : (
                <MonthGrid
                  classId={markClassId}
                  sectionId={markSectionId}
                  shiftId={shiftId || null}
                  month={catchMonth}
                  refreshKey={gridKey}
                  onPickDay={(d) => {
                    // Straight into the register that is already tested, on
                    // the day they picked. A second marking screen would be a
                    // second set of rules to keep in step with this one.
                    setDate(d);
                    setLoaded(false);
                    setTab("mark");
                  }}
                />
              )}
            </div>
          )}

          {tab === "mark" && (
            <div className="space-y-5">
              <div className={cn(
                "grid gap-3 rounded-xl border bg-secondary/20 p-4 sm:grid-cols-2",
                shifts.length > 0 ? "lg:grid-cols-6" : "lg:grid-cols-5",
              )}>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("attendanceStudents.academicYear")}</label>
                  <Select value={year} onChange={(e) => { setYear(e.target.value); setKlass(""); setSection(""); setShiftId(""); setLoaded(false); }}>
                    {academics.academicYears.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("attendanceStudents.date")}</label>
                  <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setLoaded(false); }}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("attendanceStudents.class")}</label>
                  <Select value={klass} onChange={(e) => { setKlass(e.target.value); setSection(""); setLoaded(false); }}>
                    <option value="">{t("attendanceStudents.selectClass")}</option>
                    {isTeacher && assignedClassNames ? (
                      <optgroup label={t("attendanceStudents.myClasses")}>
                        {yearClasses.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </optgroup>
                    ) : (
                      yearClassGroups.map((g) =>
                        g.label === null ? (
                          g.items.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))
                        ) : (
                          <optgroup key={g.label} label={g.label}>
                            {g.items.map((c) => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </optgroup>
                        ),
                      )
                    )}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("attendanceStudents.section")}{markClassNeedsSection ? " *" : ""}
                  </label>
                  <Select
                    value={section}
                    onChange={(e) => { setSection(e.target.value); setLoaded(false); }}
                    disabled={!markClassNeedsSection}
                  >
                    <option value="">
                      {markClassNeedsSection ? "Select section" : "— (no sections)"}
                    </option>
                    {sectionOptions.map((s) => <option key={s.id} value={s.name}>{t("attendanceStudents.section")} {s.name}</option>)}
                  </Select>
                </div>
                {shifts.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("attendanceStudents.shift")} *
                    </label>
                    <Select value={shiftId} onChange={(e) => { setShiftId(e.target.value); setLoaded(false); }}>
                      <option value="">{t("attendanceStudents.selectShift")}</option>
                      {/*
                        Retired shifts are listed and named as such. Their
                        registers cannot be opened any other way, and a day
                        that cannot be opened cannot be corrected.
                      */}
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.status === "ACTIVE"
                            ? s.name
                            : `${s.name} (${t("attendanceShifts.retired")})`}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <div className="flex items-end">
                  <Button onClick={() => void loadList()} disabled={loading} className="w-full">
                    {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                    {t("attendanceStudents.loadStudents")}
                  </Button>
                </div>
              </div>

              {loaded && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {formatDisplayDate(date)} · {klass}{section ? ` · Section ${section}` : ""}
                      {shiftId ? ` · ${shifts.find((s) => s.id === shiftId)?.name ?? ""}` : ""} · {eligibleRows.length} {t("attendanceStudents.students")}
                    </p>
                    {/*
                      Whether what is on screen is a record or a blank form.
                      The rows open on the school's default status, so an
                      untaken day and a day where everyone was present look
                      exactly alike — and an officer can overwrite a morning's
                      work believing there was nothing there.
                    */}
                    {markedCount > 0 ? (
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {t("attendanceStudents.alreadyTaken").replace(
                          "{n}",
                          String(markedCount),
                        )}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        {t("attendanceStudents.notYetTaken")}
                      </span>
                    )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => markAll("PRESENT")}>
                        <CheckCheck className="me-2 h-4 w-4" /> {t("attendanceStudents.markAllPresent")}
                      </Button>
                      <Button variant="outline" onClick={() => markAll("ABSENT")}>{t("attendanceStudents.markAllAbsent")}</Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          // The register as it stands, on school paper. A
                          // teacher who marks on paper first needs the same
                          // sheet the screen shows, not a different one.
                          printAttendanceReport({
                            kind: "DAILY",
                            scope: [
                              { label: "Academic Year", value: year },
                              { label: "Date", value: formatDisplayDate(date) },
                              { label: "Class", value: klass },
                              { label: "Section", value: section },
                              {
                                label: "Shift",
                                value:
                                  shifts.find((x) => x.id === shiftId)?.name ?? "",
                              },
                            ],
                            summary: [
                              { label: "On roll", value: String(rows.length) },
                            ],
                            columns: [
                              { key: "code", label: "Student ID", mono: true },
                              { key: "name", label: "Student Name" },
                              { key: "status", label: "Status" },
                              { key: "remarks", label: "Remarks" },
                            ],
                            rows: rows.map((r) => ({
                              code: r.code,
                              name: r.fullName,
                              status: studentStatusLabel(r.status),
                              // Left blank on purpose: this column is for the
                              // person holding the pen.
                              remarks: "",
                            })),
                          });
                        }}
                      >
                        <Printer className="me-2 h-4 w-4" /> {t("attendanceStudents.print")}
                      </Button>
                      <Button onClick={() => void handleSave()} disabled={saving}>
                        {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                        {t("attendanceStudents.saveAttendance")}
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border">
                    <div className="max-h-[520px] overflow-auto scrollbar-slim">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-start text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">#</th>
                            <th className="px-4 py-3 font-medium">{t("attendanceStudents.studentId")}</th>
                            <th className="px-4 py-3 font-medium">{t("attendanceStudents.name")}</th>
                            <th className="px-4 py-3 font-medium">{t("attendanceStudents.gender")}</th>
                            <th className="px-4 py-3 font-medium">{t("attendanceStudents.status")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={r.studentId} className={cn("border-t", !r.eligible && "bg-muted/30 opacity-60")}>
                              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                              <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                              <td className="px-4 py-3 font-medium">
                                {r.fullName}
                                {!r.eligible && <span className="ms-2 text-xs text-rose-500">({r.reason})</span>}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{genderLabel(r.gender)}</td>
                              <td className="px-4 py-3">
                                <StudentStatusPicker
                                  value={r.status}
                                  onChange={(s) => setRowStatus(r.studentId, s)}
                                  disabled={!r.eligible}
                                  compact
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {[
                      ["Total", previewSummary.total],
                      ["Present", previewSummary.present],
                      ["Absent", previewSummary.absent],
                      ["Late", previewSummary.late],
                      ["Excused", previewSummary.excused],
                    ].map(([l, v]) => (
                      <div key={l} className="rounded-lg border bg-card p-3 text-center">
                        <p className="text-xl font-bold">{v}</p>
                        <p className="text-xs text-muted-foreground">{l}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "dashboard" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("attendanceStudents.today")} {formatDisplayDate(todayISO())}</p>
              {dashboardLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="me-2 h-5 w-5 animate-spin" /> {t("attendanceStudents.loadingDashboard")}
                </div>
              ) : (
                <StudentAttendanceSummaryCards summary={dashboard} />
              )}
            </div>
          )}

          {tab === "reports" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={rSearch} onChange={(e) => setRSearch(e.target.value)} placeholder={t("attendanceStudents.searchStudent")}
                    className="h-10 w-full rounded-lg border bg-background ps-9 pe-3 text-sm outline-none" />
                </div>
                <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)}
                  className="h-10 rounded-lg border bg-background px-3 text-sm" />
                <Select value={rClass} onChange={(e) => setRClass(e.target.value)} className="w-32">
                  <option value="">{t("attendanceStudents.allClasses")}</option>
                  {yearClassGroups.map((g) =>
                    g.label === null ? (
                      g.items.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))
                    ) : (
                      <optgroup key={g.label} label={g.label}>
                        {g.items.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </optgroup>
                    ),
                  )}
                </Select>
                <Select value={rSection} onChange={(e) => setRSection(e.target.value)} className="w-32">
                  <option value="">{t("attendanceStudents.allSections")}</option>
                  {(rClass ? sectionsForClass(classByName(rClass, year)?.id ?? "") : []).map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </Select>
                <Select value={rStatus} onChange={(e) => setRStatus(e.target.value)} className="w-32">
                  <option value="">{t("attendanceStudents.allStatus")}</option>
                  <option value="PRESENT">{t("attendanceStudents.present")}</option>
                  <option value="ABSENT">{t("attendanceStudents.absent")}</option>
                  <option value="LATE">{t("attendanceStudents.late")}</option>
                  <option value="EXCUSED">{t("attendanceStudents.excused")}</option>
                </Select>
                {shifts.length > 0 && (
                  <Select value={rShiftId} onChange={(e) => setRShiftId(e.target.value)} className="w-32">
                    <option value="">{t("attendanceStudents.allShifts")}</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                )}
                <Button variant="outline" onClick={() => {
                  exportStudentAttendanceCsv(reportRows.map((r) => ({
                    code: r.code, name: r.student, className: r.className,
                    section: r.section, date: r.date, status: r.status as StudentAttendanceStatus,
                  })));
                  toast("Report exported.", "info");
                }}><FileDown className="me-2 h-4 w-4" /> {t("attendanceStudents.csv")}</Button>
                <Button variant="outline" onClick={() => {
                  if (reportRows.length === 0) return toast("No records to print.", "error");
                  // Whatever the screen is showing, on school paper. The
                  // figures are the ones already computed above, not a second
                  // count that could disagree with the table under it.
                  printAttendanceReport({
                    kind: "DAILY",
                    scope: [
                      { label: "Academic Year", value: year },
                      { label: "Date", value: rDate || "All dates" },
                      { label: "Class", value: rClass || "All classes" },
                      { label: "Section", value: rSection || "All sections" },
                      { label: "Status", value: rStatus || "All statuses" },
                    ],
                    summary: reportSummary.map((x) => ({
                      label: x.label,
                      value: String(x.value),
                    })),
                    columns: [
                      { key: "code", label: "Student ID", mono: true },
                      { key: "student", label: "Student Name" },
                      { key: "className", label: "Class" },
                      { key: "section", label: "Section" },
                      { key: "date", label: "Date" },
                      { key: "status", label: "Status" },
                    ],
                    rows: reportRows.map((r) => ({
                      code: r.code,
                      student: r.student,
                      className: r.className,
                      section: r.section,
                      date: r.date,
                      status: r.status,
                    })),
                  });
                }}><Printer className="me-2 h-4 w-4" /> {t("attendanceStudents.print")}</Button>
              </div>

              {reportRows.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {reportSummary.map((s) => (
                    <div key={s.label} className="rounded-lg border bg-card p-3 text-center">
                      <p className="text-xl font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-start text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">{t("attendanceStudents.date")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("attendanceStudents.student")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("attendanceStudents.class")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("attendanceStudents.section")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("attendanceStudents.shift")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("attendanceStudents.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportLoading ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                          <Loader2 className="me-2 inline h-4 w-4 animate-spin" /> {t("attendanceStudents.loadingRecords")}
                        </td></tr>
                      ) : reportRows.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{t("attendanceStudents.noRecordsForThisDate")}</td></tr>
                      ) : (
                        reportRows.slice(0, 100).map((r, i) => (
                          <tr key={`${r.code}-${r.date}-${i}`} className="border-t">
                            <td className="px-4 py-2.5">{r.date}</td>
                            <td className="px-4 py-2.5">{r.student}</td>
                            <td className="px-4 py-2.5">{r.className}</td>
                            <td className="px-4 py-2.5">{r.section}</td>
                            <td className="px-4 py-2.5">{r.shift}</td>
                            <td className="px-4 py-2.5">{studentStatusLabel(r.status as StudentAttendanceStatus)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary for this route to build; the
 * screen itself is unchanged behind it.
 */
export default function StudentAttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <StudentAttendanceScreen />
    </Suspense>
  );
}
