"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  FileDown,
  FileText,
  GraduationCap,
  Info,
  Layers,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/academics/status-badge";
import { SectionFormDialog } from "@/components/academics/section-form-dialog";
import { AssignSubjectDialog } from "@/components/academics/assign-subject-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  classStatistics,
  deleteSection,
  getClass,
  removeSubjectFromClass,
  sectionsForClass,
  subjectsForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { money, percent } from "@/lib/academics/format";
import { printTable } from "@/lib/academics/print";
import { getState as getStudentsState } from "@/lib/students/store";
import { getTeachersState } from "@/lib/teachers/store";
import { getExaminationsState } from "@/lib/examinations/store";
import type { Section, Subject } from "@/lib/academics/types";
import { toast } from "@/lib/toast";

const TABS = [
  { id: "general", label: "General", icon: <Info className="h-4 w-4" /> },
  { id: "sections", label: "Sections", icon: <Layers className="h-4 w-4" /> },
  { id: "students", label: "Students", icon: <Users className="h-4 w-4" /> },
  { id: "subjects", label: "Subjects", icon: <BookOpen className="h-4 w-4" /> },
  { id: "teachers", label: "Teachers", icon: <GraduationCap className="h-4 w-4" /> },
  { id: "attendance", label: "Attendance", icon: <CalendarCheck className="h-4 w-4" /> },
  { id: "exams", label: "Examinations", icon: <FileText className="h-4 w-4" /> },
  { id: "reports", label: "Reports", icon: <FileDown className="h-4 w-4" /> },
];

export default function ClassProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = useAcademicsState();

  const [tab, setTab] = useState("general");
  const [sectionOpen, setSectionOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [deletingSection, setDeletingSection] = useState<Section | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [removingSubject, setRemovingSubject] = useState<Subject | null>(null);

  const cls = getClass(id);

  const stats = useMemo(() => classStatistics(id), [state, id]);
  const sections = useMemo(() => sectionsForClass(id), [state, id]);
  const subjects = useMemo(() => subjectsForClass(id), [state, id]);

  const students = useMemo(() => {
    if (!cls) return [];
    return getStudentsState()
      .students.filter(
        (s) =>
          s.status === "ACTIVE" &&
          s.className === cls.name &&
          s.academicYear === cls.academicYear,
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [state, cls]);

  const teacherRows = useMemo(() => {
    if (!cls) return [];
    const tt = getTeachersState();
    return tt.assignments
      .filter(
        (a) =>
          a.status === "ACTIVE" &&
          a.className === cls.name &&
          a.academicYear === cls.academicYear,
      )
      .map((a) => ({
        ...a,
        teacherName: tt.teachers.find((t) => t.id === a.teacherId)?.fullName ?? "—",
      }));
  }, [state, cls]);

  const exams = useMemo(() => {
    if (!cls) return [];
    return getExaminationsState().exams.filter(
      (e) => e.className === cls.name && e.academicYear === cls.academicYear,
    );
  }, [state, cls]);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading class…
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="space-y-4">
        <Link href="/academics/classes" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Classes
        </Link>
        <p className="text-muted-foreground">Class not found.</p>
      </div>
    );
  }

  async function handleDeleteSection() {
    if (!deletingSection) return;
    const res = await deleteSection(deletingSection.id);
    if (!res.ok) toast(res.error ?? "Delete failed.", "error");
    else toast("Section deleted.", "success");
    setDeletingSection(null);
  }

  async function handleRemoveSubject() {
    if (!removingSubject) return;
    const res = await removeSubjectFromClass(id, removingSubject.id);
    if (!res.ok) toast(res.error ?? "Remove failed.", "error");
    else toast(`${removingSubject.name} removed from ${cls?.name}.`, "success");
    setRemovingSubject(null);
  }

  const STAT_CARDS = [
    { label: "Total Students", value: stats.totalStudents, icon: Users },
    { label: "Male", value: stats.maleStudents, icon: Users },
    { label: "Female", value: stats.femaleStudents, icon: Users },
    { label: "Sections", value: stats.totalSections, icon: Layers },
    { label: "Subjects", value: stats.assignedSubjects, icon: BookOpen },
    { label: "Teachers", value: stats.assignedTeachers, icon: GraduationCap },
    { label: "Attendance", value: percent(stats.attendancePercentage), icon: CalendarCheck },
    { label: "Exam Avg", value: percent(stats.examAverage), icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <Link href="/academics/classes" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Classes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
            {cls.name.replace(/\D/g, "") || cls.name.charAt(0)}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{cls.name}</h1>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              {cls.academicYear} <StatusBadge status={cls.status} />
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {STAT_CARDS.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-3 shadow-sm">
            <c.icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2 text-lg font-bold tabular-nums">{c.value}</p>
            <p className="truncate text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="px-4" />
        <div className="p-5">
          {tab === "general" && (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Class Name" value={cls.name} />
              <Field label="Academic Year" value={cls.academicYear} />
              <Field label="Has Sections" value={cls.hasSections ? "Yes" : "No"} />
              <Field label="Status" value={<StatusBadge status={cls.status} />} />
              <Field label="Fee Collection" value={`${money(stats.feeCollected)} / ${money(stats.feeExpected)}`} />
              <Field label="Notes" value={cls.notes || "—"} />
            </dl>
          )}

          {tab === "sections" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{sections.length} section(s)</p>
                <Button onClick={() => { setEditingSection(null); setSectionOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" /> Add Section
                </Button>
              </div>
              {sections.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">This class has no sections.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sections.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border p-4">
                      <div>
                        <p className="font-semibold">Section {s.name}</p>
                        <StatusBadge status={s.status} />
                      </div>
                      <div className="flex gap-1">
                        <IconBtn title="Edit" icon={Pencil} onClick={() => { setEditingSection(s); setSectionOpen(true); }} />
                        <IconBtn title="Delete" icon={Trash2} danger onClick={() => setDeletingSection(s)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "students" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{students.length} enrolled student(s)</p>
                <Button
                  variant="outline"
                  onClick={() =>
                    printTable({
                      title: `${cls.name} — Student List`,
                      academicYear: cls.academicYear,
                      columns: ["#", "Student ID", "Name", "Gender", "Section"],
                      rows: students.map((s, i) => [i + 1, s.code, s.fullName, s.gender, s.section ?? "—"]),
                    })
                  }
                >
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
              </div>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">#</th>
                      <th className="px-4 py-2.5 font-medium">Student ID</th>
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">Gender</th>
                      <th className="px-4 py-2.5 font-medium">Section</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No students enrolled.</td></tr>
                    ) : (
                      students.map((s, i) => (
                        <tr key={s.id} className="border-t">
                          <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2.5 font-mono text-xs">{s.code}</td>
                          <td className="px-4 py-2.5">
                            <Link href={`/students/${s.id}`} className="font-medium hover:text-primary hover:underline">{s.fullName}</Link>
                          </td>
                          <td className="px-4 py-2.5">{s.gender.charAt(0) + s.gender.slice(1).toLowerCase()}</td>
                          <td className="px-4 py-2.5">{s.section ? `Section ${s.section}` : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "subjects" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{subjects.length} assigned subject(s)</p>
                <Button onClick={() => setAssignOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Assign Subject
                </Button>
              </div>
              {subjects.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No subjects assigned to this class.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {subjects.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border p-4">
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        {s.code && <p className="font-mono text-xs text-muted-foreground">{s.code}</p>}
                      </div>
                      <IconBtn title="Remove" icon={Trash2} danger onClick={() => setRemovingSubject(s)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "teachers" && (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Teacher</th>
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    <th className="px-4 py-2.5 font-medium">Section</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherRows.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">No teachers assigned to this class.</td></tr>
                  ) : (
                    teacherRows.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="px-4 py-2.5">
                          <Link href={`/teachers/${a.teacherId}`} className="font-medium hover:text-primary hover:underline">{a.teacherName}</Link>
                        </td>
                        <td className="px-4 py-2.5">{a.subject}</td>
                        <td className="px-4 py-2.5">{a.section ? `Section ${a.section}` : "All sections"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "attendance" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatBlock label="Attendance Rate" value={percent(stats.attendancePercentage)} />
              <StatBlock label="Total Students" value={String(stats.totalStudents)} />
              <StatBlock label="Sections" value={String(stats.totalSections)} />
              <p className="sm:col-span-3 text-sm text-muted-foreground">
                Detailed daily attendance is available in the Attendance module.
              </p>
            </div>
          )}

          {tab === "exams" && (
            <div className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatBlock label="Active Exams" value={String(exams.filter((e) => e.status === "OPEN" || e.status === "IN_PROGRESS").length)} />
                <StatBlock label="Published Results" value={String(exams.filter((e) => e.status === "PUBLISHED").length)} />
                <StatBlock label="Exam Average" value={percent(stats.examAverage)} />
              </div>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Exam</th>
                      <th className="px-4 py-2.5 font-medium">Section</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">No examinations for this class.</td></tr>
                    ) : (
                      exams.map((e) => (
                        <tr key={e.id} className="border-t">
                          <td className="px-4 py-2.5 font-medium">{e.name}</td>
                          <td className="px-4 py-2.5">{e.section ? `Section ${e.section}` : "—"}</td>
                          <td className="px-4 py-2.5"><Badge tone="info">{e.status}</Badge></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "reports" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <ReportBtn
                label="Student List"
                onClick={() =>
                  printTable({
                    title: `${cls.name} — Student List`,
                    academicYear: cls.academicYear,
                    columns: ["#", "Student ID", "Name", "Gender", "Section"],
                    rows: students.map((s, i) => [i + 1, s.code, s.fullName, s.gender, s.section ?? "—"]),
                  })
                }
              />
              <ReportBtn
                label="Attendance Report"
                onClick={() =>
                  printTable({
                    title: `${cls.name} — Attendance Summary`,
                    academicYear: cls.academicYear,
                    columns: ["Metric", "Value"],
                    rows: [
                      ["Attendance Rate", percent(stats.attendancePercentage)],
                      ["Total Students", stats.totalStudents],
                      ["Sections", stats.totalSections],
                    ],
                  })
                }
              />
              <ReportBtn
                label="Result Report"
                onClick={() =>
                  printTable({
                    title: `${cls.name} — Results Overview`,
                    academicYear: cls.academicYear,
                    columns: ["Exam", "Section", "Status"],
                    rows: exams.map((e) => [e.name, e.section ?? "—", e.status]),
                  })
                }
              />
              <ReportBtn
                label="Fee Summary"
                onClick={() =>
                  printTable({
                    title: `${cls.name} — Fee Summary`,
                    academicYear: cls.academicYear,
                    columns: ["Metric", "Value"],
                    rows: [
                      ["Expected", money(stats.feeExpected)],
                      ["Collected", money(stats.feeCollected)],
                      ["Outstanding", money(stats.feeExpected - stats.feeCollected)],
                    ],
                  })
                }
              />
            </div>
          )}
        </div>
      </div>

      <SectionFormDialog
        open={sectionOpen}
        onClose={() => setSectionOpen(false)}
        section={editingSection}
        defaultClassId={id}
      />
      <AssignSubjectDialog open={assignOpen} onClose={() => setAssignOpen(false)} classId={id} />
      <ConfirmDialog
        open={!!deletingSection}
        title="Delete Section"
        message={deletingSection ? `Delete Section ${deletingSection.name}? Sections with students cannot be deleted.` : ""}
        onConfirm={handleDeleteSection}
        onClose={() => setDeletingSection(null)}
      />
      <ConfirmDialog
        open={!!removingSubject}
        title="Remove Subject"
        message={removingSubject ? `Remove ${removingSubject.name} from ${cls.name}?` : ""}
        confirmLabel="Remove"
        onConfirm={handleRemoveSubject}
        onClose={() => setRemovingSubject(null)}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-secondary/30 p-4">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function IconBtn({ icon: Icon, title, onClick, danger }: { icon: typeof Pencil; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors ${danger ? "hover:bg-rose-500/10 hover:text-rose-600" : "hover:bg-secondary hover:text-foreground"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ReportBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="font-medium">{label}</span>
      <Printer className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
