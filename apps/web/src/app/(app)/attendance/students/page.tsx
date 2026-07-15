"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCheck,
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
  filterStudentRecords,
  loadStudentMarkingRows,
  saveStudentAttendance,
  studentDashboardToday,
  useAttendanceState,
  type AttendanceSummary,
} from "@/lib/attendance/store";
import {
  formatDisplayDate,
  studentStatusLabel,
  todayISO,
} from "@/lib/attendance/format";
import {
  exportStudentAttendanceCsv,
  printStudentAttendanceSheet,
} from "@/lib/attendance/print";
import {
  activeAcademicYear,
  classByName,
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

const TABS = [
  { id: "mark", label: "Mark Attendance" },
  { id: "dashboard", label: "Dashboard" },
  { id: "reports", label: "Reports" },
];

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const [mounted, setMounted] = useState(false);
  const [teacherMe, setTeacherMe] = useState<TeacherMe | null>(null);
  useEffect(() => setMounted(true), []);

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
  const [rows, setRows] = useState<StudentMarkRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rSearch, setRSearch] = useState("");
  const [rDate, setRDate] = useState(todayISO());
  const [rClass, setRClass] = useState("");
  const [rSection, setRSection] = useState("");
  const [rStatus, setRStatus] = useState("");
  const [reportRows, setReportRows] = useState<
    Awaited<ReturnType<typeof filterStudentRecords>>
  >([]);
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

  const selectedMarkClass = useMemo(() => classByName(klass, year), [klass, year]);
  const markClassNeedsSection = selectedMarkClass?.hasSections ?? true;

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
      void studentDashboardToday(todayISO(), cls.id, sec?.id)
        .then(setDashboard)
        .finally(() => setDashboardLoading(false));
      return;
    }
    setDashboardLoading(true);
    void studentDashboardToday(todayISO())
      .then(setDashboard)
      .finally(() => setDashboardLoading(false));
  }, [tab, mounted, isTeacher, klass, section, year, sectionOptions]);

  useEffect(() => {
    if (tab !== "reports" || !mounted || !year) return;
    setReportLoading(true);
    void filterStudentRecords({
      academicYear: year,
      date: rDate || undefined,
      className: rClass || undefined,
      section: rSection || undefined,
      status: (rStatus as StudentAttendanceStatus) || undefined,
      search: rSearch,
    })
      .then(setReportRows)
      .finally(() => setReportLoading(false));
  }, [tab, mounted, year, rDate, rClass, rSection, rStatus, rSearch]);

  async function loadList() {
    if (!klass) return toast("Select a class.", "error");
    if (markClassNeedsSection && !section) return toast("Select a section.", "error");
    setLoading(true);
    const res = await loadStudentMarkingRows(year, klass, section, date);
    setLoading(false);
    if (res.error) return toast(res.error, "error");
    setRows(res.rows);
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
    );
    setSaving(false);
    if (!res.ok) return toast(res.error ?? "Save failed.", "error");
    toast(
      `Attendance saved. ${res.summary?.present} present, ${res.summary?.absent} absent (${res.summary?.percentage}%).`,
    );
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
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      {!isTeacher && (
      <Link href="/attendance" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Attendance
      </Link>
      )}

      <div>
        <h1 className="text-2xl font-bold">Student Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record attendance per class and section. Students are never mixed across sections.
        </p>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="px-2" />

        <div className="p-6">
          {tab === "mark" && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-xl border bg-secondary/20 p-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Academic Year</label>
                  <Select value={year} onChange={(e) => { setYear(e.target.value); setLoaded(false); }}>
                    {academics.academicYears.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
                  <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setLoaded(false); }}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Class *</label>
                  <Select value={klass} onChange={(e) => { setKlass(e.target.value); setSection(""); setLoaded(false); }}>
                    <option value="">Select class</option>
                    {yearClasses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Section{markClassNeedsSection ? " *" : ""}
                  </label>
                  <Select
                    value={section}
                    onChange={(e) => { setSection(e.target.value); setLoaded(false); }}
                    disabled={!markClassNeedsSection}
                  >
                    <option value="">
                      {markClassNeedsSection ? "Select section" : "— (no sections)"}
                    </option>
                    {sectionOptions.map((s) => <option key={s.id} value={s.name}>Section {s.name}</option>)}
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={() => void loadList()} disabled={loading} className="w-full">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Load Students
                  </Button>
                </div>
              </div>

              {loaded && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {formatDisplayDate(date)} · {klass}{section ? ` · Section ${section}` : ""} · {eligibleRows.length} students
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => markAll("PRESENT")}>
                        <CheckCheck className="mr-2 h-4 w-4" /> Mark All Present
                      </Button>
                      <Button variant="outline" onClick={() => markAll("ABSENT")}>Mark All Absent</Button>
                      <Button onClick={() => void handleSave()} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Attendance
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border">
                    <div className="max-h-[520px] overflow-auto scrollbar-slim">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-left text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">#</th>
                            <th className="px-4 py-3 font-medium">Student ID</th>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Gender</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={r.studentId} className={cn("border-t", !r.eligible && "bg-muted/30 opacity-60")}>
                              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                              <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                              <td className="px-4 py-3 font-medium">
                                {r.fullName}
                                {!r.eligible && <span className="ml-2 text-xs text-rose-500">({r.reason})</span>}
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
              <p className="text-sm text-muted-foreground">Today — {formatDisplayDate(todayISO())}</p>
              {dashboardLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading dashboard…
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
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={rSearch} onChange={(e) => setRSearch(e.target.value)} placeholder="Search student…"
                    className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none" />
                </div>
                <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)}
                  className="h-10 rounded-lg border bg-background px-3 text-sm" />
                <Select value={rClass} onChange={(e) => setRClass(e.target.value)} className="w-32">
                  <option value="">All Classes</option>
                  {yearClasses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </Select>
                <Select value={rSection} onChange={(e) => setRSection(e.target.value)} className="w-32">
                  <option value="">All Sections</option>
                  {(rClass ? sectionsForClass(classByName(rClass, year)?.id ?? "") : []).map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </Select>
                <Select value={rStatus} onChange={(e) => setRStatus(e.target.value)} className="w-32">
                  <option value="">All Status</option>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LATE">Late</option>
                  <option value="EXCUSED">Excused</option>
                </Select>
                <Button variant="outline" onClick={() => {
                  exportStudentAttendanceCsv(reportRows.map((r) => ({
                    code: r.student.code, name: r.student.fullName, className: r.className,
                    section: r.section, date: r.date, status: r.status,
                  })));
                  toast("Report exported.", "info");
                }}><FileDown className="mr-2 h-4 w-4" /> CSV</Button>
                <Button variant="outline" onClick={() => {
                  if (reportRows.length === 0) return toast("No records to print.", "error");
                  const first = reportRows[0];
                  printStudentAttendanceSheet({
                    academicYear: first.academicYear,
                    date: first.date,
                    className: first.className,
                    section: first.section ?? "",
                    rows: reportRows.map((r, i) => ({
                      serial: i + 1, code: r.student.code, name: r.student.fullName, status: r.status,
                    })),
                    summary: previewSummary,
                  });
                }}><Printer className="mr-2 h-4 w-4" /> Print</Button>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Student</th>
                      <th className="px-4 py-2.5 font-medium">Class</th>
                      <th className="px-4 py-2.5 font-medium">Section</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportLoading ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading records…
                      </td></tr>
                    ) : reportRows.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No records for this date.</td></tr>
                    ) : (
                      reportRows.slice(0, 100).map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-4 py-2.5">{r.date}</td>
                          <td className="px-4 py-2.5">{r.student.fullName}</td>
                          <td className="px-4 py-2.5">{r.className}</td>
                          <td className="px-4 py-2.5">{r.section}</td>
                          <td className="px-4 py-2.5">{studentStatusLabel(r.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
