"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCheck,
  FileDown,
  Printer,
  RotateCcw,
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
  resetAttendance,
  saveStudentAttendance,
  studentDashboardToday,
  useAttendanceState,
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
import { ACADEMIC_YEARS, ACTIVE_ACADEMIC_YEAR, CLASSES, SECTIONS } from "@/lib/students/constants";
import { genderLabel } from "@/lib/students/format";
import type { StudentAttendanceStatus } from "@/lib/attendance/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "mark", label: "Mark Attendance" },
  { id: "dashboard", label: "Dashboard" },
  { id: "reports", label: "Reports" },
];

export default function StudentAttendancePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useAttendanceState();
  const [tab, setTab] = useState("mark");

  const [year, setYear] = useState<string>(ACTIVE_ACADEMIC_YEAR);
  const [date, setDate] = useState(todayISO());
  const [klass, setKlass] = useState("");
  const [section, setSection] = useState("");
  const [rows, setRows] = useState<ReturnType<typeof loadStudentMarkingRows>>([]);
  const [loaded, setLoaded] = useState(false);

  const [rSearch, setRSearch] = useState("");
  const [rDate, setRDate] = useState(todayISO());
  const [rClass, setRClass] = useState("");
  const [rSection, setRSection] = useState("");
  const [rStatus, setRStatus] = useState("");

  const dashboard = useMemo(() => studentDashboardToday(todayISO()), [tab]);

  const reportRows = useMemo(
    () =>
      filterStudentRecords({
        academicYear: year,
        date: rDate || undefined,
        className: rClass || undefined,
        section: rSection || undefined,
        status: (rStatus as StudentAttendanceStatus) || undefined,
        search: rSearch,
      }),
    [year, rDate, rClass, rSection, rStatus, rSearch, tab],
  );

  function loadList() {
    if (!klass) return toast("Select a class.", "error");
    if (!section) return toast("Select a section.", "error");
    setRows(loadStudentMarkingRows(year, klass, section, date));
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

  function handleSave() {
    if (!loaded || !klass || !section) return;
    const eligible = rows.filter((r) => r.eligible);
    const res = saveStudentAttendance(
      year,
      klass,
      section,
      date,
      eligible.map((r) => ({ studentId: r.studentId, status: r.status })),
    );
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
            (eligibleRows.filter((r) => r.status === "PRESENT").length /
              eligibleRows.length) *
              1000,
          ) / 10,
  };

  if (!mounted) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <Link href="/attendance" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Attendance
      </Link>

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
                    {ACADEMIC_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
                  <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setLoaded(false); }}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Class *</label>
                  <Select value={klass} onChange={(e) => { setKlass(e.target.value); setLoaded(false); }}>
                    <option value="">Select class</option>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Section *</label>
                  <Select value={section} onChange={(e) => { setSection(e.target.value); setLoaded(false); }}>
                    <option value="">Select section</option>
                    {SECTIONS.map((s) => <option key={s} value={s}>Section {s}</option>)}
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={loadList} className="w-full">Load Students</Button>
                </div>
              </div>

              {loaded && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {formatDisplayDate(date)} · {klass} · Section {section} · {eligibleRows.length} students
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => markAll("PRESENT")}>
                        <CheckCheck className="mr-2 h-4 w-4" /> Mark All Present
                      </Button>
                      <Button variant="outline" onClick={() => markAll("ABSENT")}>Mark All Absent</Button>
                      <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Save Attendance</Button>
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
              <StudentAttendanceSummaryCards summary={dashboard} />
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
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Select value={rSection} onChange={(e) => setRSection(e.target.value)} className="w-32">
                  <option value="">All Sections</option>
                  {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
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
                    {reportRows.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No records.</td></tr>
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

      <div className="flex justify-end">
        <button onClick={() => { resetAttendance(); toast("Attendance demo data reset.", "info"); }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
        </button>
      </div>
    </div>
  );
}
