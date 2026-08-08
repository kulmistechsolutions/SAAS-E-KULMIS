"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { AlertTriangle, Loader2, Printer, Save, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs } from "@/components/ui/tabs";
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
} from "@/lib/student-cases/api";
import { printStudentCases } from "@/lib/student-cases/print";
import type {
  StudentCaseDashboard,
  StudentCaseRecord,
} from "@/lib/student-cases/types";
import { toast } from "@/lib/toast";

const TABS = [
  { id: "add", label: "Add Case" },
  { id: "dashboard", label: "Dashboard" },
  { id: "reports", label: "Reports" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentCasesPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    void refreshStudents();
  }, []);

  const academics = useAcademicsState();
  const studentsState = useStudentsState();
  const [tab, setTab] = useState("add");

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

  // --- Add Case form ---
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
      if (tab === "dashboard") void loadDashboard();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to record case.", "error");
    } finally {
      setSaving(false);
    }
  }

  // --- Dashboard ---
  const [dashboard, setDashboard] = useState<StudentCaseDashboard>({
    total: 0,
    topStudents: [],
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);

  async function loadDashboard() {
    setDashboardLoading(true);
    try {
      setDashboard(await apiStudentCasesDashboard());
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "dashboard" || !mounted) return;
    void loadDashboard();
  }, [tab, mounted]);

  // --- Reports/History ---
  const [rClass, setRClass] = useState("");
  const [rDate, setRDate] = useState("");
  const [rRows, setRRows] = useState<StudentCaseRecord[]>([]);
  const [rLoading, setRLoading] = useState(false);

  async function loadReport() {
    const cls = rClass ? classByName(rClass, year) : null;
    setRLoading(true);
    try {
      setRRows(
        await apiListStudentCases({
          classId: cls?.id,
          dateFrom: rDate || undefined,
          dateTo: rDate || undefined,
        }),
      );
    } finally {
      setRLoading(false);
    }
  }

  useEffect(() => {
    if (tab !== "reports" || !mounted) return;
    void loadReport();
  }, [tab, mounted, rClass, rDate, year]);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("attendanceStudents.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          {t("studentCases.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("studentCases.description")}
        </p>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="px-2" />

        <div className="p-6">
          {tab === "add" && (
            <div className="max-w-2xl space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("attendanceStudents.academicYear")}
                  </label>
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
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("studentCases.date")}
                  </label>
                  <input
                    type="date"
                    value={fDate}
                    onChange={(e) => setFDate(e.target.value)}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("attendanceStudents.class")}
                  </label>
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
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("attendanceStudents.section")}
                    {fNeedsSection ? " *" : ""}
                  </label>
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
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("studentCases.student")}
                  </label>
                  <Select value={fStudentId} onChange={(e) => setFStudentId(e.target.value)}>
                    <option value="">{t("studentCases.selectStudent")}</option>
                    {fStudentOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.fullName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("studentCases.caseTitle")}
                  </label>
                  <input
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                    placeholder={t("studentCases.caseTitlePlaceholder")}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("studentCases.note")}
                  </label>
                  <Textarea
                    value={fNote}
                    onChange={(e) => setFNote(e.target.value)}
                    rows={4}
                    placeholder={t("studentCases.notePlaceholder")}
                  />
                </div>
              </div>
              <Button onClick={() => void handleCreateCase()} disabled={saving}>
                {saving ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="me-2 h-4 w-4" />
                )}
                {t("studentCases.saveCase")}
              </Button>
            </div>
          )}

          {tab === "dashboard" && (
            <div className="space-y-4">
              {dashboardLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="me-2 h-5 w-5 animate-spin" />
                  {t("attendanceStudents.loadingDashboard")}
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white shadow-lg">
                        <AlertTriangle className="h-6 w-6" />
                      </span>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("studentCases.totalCases")}
                        </p>
                        <p className="text-3xl font-bold tabular-nums">{dashboard.total}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-card shadow-sm">
                    <div className="flex items-center gap-2 border-b px-5 py-3 font-medium">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      {t("studentCases.topStudents")}
                    </div>
                    {dashboard.topStudents.length === 0 ? (
                      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                        {t("studentCases.noCasesYet")}
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-secondary text-start text-xs text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2.5 font-medium">#</th>
                            <th className="px-4 py-2.5 font-medium">
                              {t("attendanceStudents.studentId")}
                            </th>
                            <th className="px-4 py-2.5 font-medium">
                              {t("attendanceStudents.name")}
                            </th>
                            <th className="px-4 py-2.5 font-medium">
                              {t("studentCases.cases")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.topStudents.map((s, i) => (
                            <tr key={s.studentId} className="border-t">
                              <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                              <td className="px-4 py-2.5 font-mono text-xs">{s.studentCode}</td>
                              <td className="px-4 py-2.5 font-medium">{s.studentName}</td>
                              <td className="px-4 py-2.5 tabular-nums">{s.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "reports" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[160px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("attendanceStudents.class")}
                  </label>
                  <Select value={rClass} onChange={(e) => setRClass(e.target.value)}>
                    <option value="">{t("attendanceStudents.allClasses")}</option>
                    {renderClassOptions()}
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("studentCases.date")}
                  </label>
                  <input
                    type="date"
                    value={rDate}
                    onChange={(e) => setRDate(e.target.value)}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (rRows.length === 0) return toast("No cases to print.", "error");
                    printStudentCases({
                      scope: rClass ? rClass : t("attendanceStudents.allClasses"),
                      rows: rRows,
                    });
                  }}
                >
                  <Printer className="me-2 h-4 w-4" /> {t("attendanceStudents.print")}
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-start text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">
                        {t("attendanceStudents.studentId")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("attendanceStudents.student")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">{t("studentCases.caseTitle")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("studentCases.note")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("studentCases.date")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("printHistory.printedBy")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                          <Loader2 className="me-2 inline h-4 w-4 animate-spin" />
                          {t("attendanceStudents.loadingRecords")}
                        </td>
                      </tr>
                    ) : rRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                          {t("studentCases.noCasesYet")}
                        </td>
                      </tr>
                    ) : (
                      rRows.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-4 py-2.5 font-mono text-xs">{r.studentCode}</td>
                          <td className="px-4 py-2.5 font-medium">{r.studentName}</td>
                          <td className="px-4 py-2.5">{r.title}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{r.note ?? "—"}</td>
                          <td className="px-4 py-2.5">{r.date}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {r.recordedByUsername ?? "—"}
                          </td>
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
