"use client";


import { useT } from "@/lib/i18n/provider";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Download,
  FileText,
  KeyRound,
  Pencil,
  Printer,
  Receipt,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { TeacherFormDialog } from "@/components/teachers/teacher-form-dialog";
import { AssignmentFormDialog } from "@/components/teachers/assignment-form-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  deleteAssignment,
  getTeacher,
  groupTeacherAssignments,
  resetTeacherPassword,
  teacherAssignments,
  useTeachersState,
} from "@/lib/teachers/store";
import {
  assignmentShiftLabel,
  genderLabel,
  longDate,
  money,
  sectionLabel,
  shiftLabel,
  shortDate,
  statusLabel,
} from "@/lib/teachers/format";
import {
  monitoringRows,
  teacherExams,
  useExaminationsState,
} from "@/lib/examinations/store";
import {
  employeePayrollHistory,
  getEmployee,
} from "@/lib/salary/store";
import { monthLabel } from "@/lib/salary/format";
import { PayrollStatusBadge } from "@/components/salary/status-badge";
import { PayslipDialog } from "@/components/salary/payslip-dialog";
import { printPayslip } from "@/lib/salary/print";
import type { PayrollRecord } from "@/lib/salary/types";
import {
  teacherQuizSummary,
} from "@/lib/quiz/store";
import {
  teacherAttendanceHistory,
} from "@/lib/teachers/history";
import { DEFAULT_TEACHER_EXPORT_FIELDS, exportTeachersCsv, printTeacherProfile } from "@/lib/teachers/print";
import type { EmploymentStatus, TeacherAssignment } from "@/lib/teachers/types";
import { toast } from "@/lib/toast";
import { DEFAULT_TEACHER_PASSWORD } from "@/lib/teachers/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_TONE: Record<EmploymentStatus, "success" | "muted"> = {
  ACTIVE: "success",
  INACTIVE: "muted",
};

const TAB_LIST = [
  { id: "personal", label: "Personal", icon: <User className="h-4 w-4" /> },
  { id: "login", label: "Login", icon: <KeyRound className="h-4 w-4" /> },
  { id: "assignments", label: "Assignments", icon: <BookOpen className="h-4 w-4" /> },
  { id: "attendance", label: "Attendance", icon: <CalendarCheck className="h-4 w-4" /> },
  { id: "exams", label: "Exams", icon: <FileText className="h-4 w-4" /> },
  { id: "quizzes", label: "Quizzes", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "salary", label: "Salary", icon: <Receipt className="h-4 w-4" /> },
];

export default function TeacherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useT();
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          {t("teachers.loadingProfile")}
        </div>
      }
    >
      <TeacherProfileContent id={id} />
    </Suspense>
  );
}

function TeacherProfileContent({ id }: { id: string }) {
  const t = useT();
  const search = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const state = useTeachersState();
  const teacher = useMemo(() => getTeacher(id), [state, id]);
  const assignments = useMemo(
    () => (teacher ? teacherAssignments(teacher.id) : []),
    [state.assignments, teacher],
  );
  const grouped = useMemo(
    () => (teacher ? groupTeacherAssignments(teacher.id) : []),
    [state.assignments, teacher],
  );

  const [tab, setTab] = useState(search.get("tab") ?? "personal");
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editAssign, setEditAssign] = useState<TeacherAssignment | null>(null);
  const [deleteAssign, setDeleteAssign] = useState<TeacherAssignment | null>(null);
  const [loginPassword, setLoginPassword] = useState(DEFAULT_TEACHER_PASSWORD);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (teacher) setLoginPassword(teacher.password || DEFAULT_TEACHER_PASSWORD);
  }, [teacher?.id, teacher?.password]);

  if (!mounted) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">{t("teachers.loadingProfile")}</div>;
  }

  if (!teacher) {
    return (
      <div className="space-y-4">
        <Link href="/teachers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("teachers.backToTeachers")}
        </Link>
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          {t("teachers.teacherNotFound")}
        </div>
      </div>
    );
  }

  async function handleSavePassword() {
    const next = loginPassword.trim();
    if (next.length < 5) {
      toast("Password must be at least 5 characters.", "error");
      return;
    }
    setSavingPassword(true);
    const res = await resetTeacherPassword(teacher!.id, next);
    setSavingPassword(false);
    if (res.ok) {
      toast(`Password updated for ${teacher!.code}.`, "success");
    } else {
      toast(res.error ?? "Save failed", "error");
    }
  }

  async function handleResetPassword() {
    setLoginPassword(DEFAULT_TEACHER_PASSWORD);
    const res = await resetTeacherPassword(teacher!.id, DEFAULT_TEACHER_PASSWORD);
    if (res.ok) {
      toast(`Password reset to ${DEFAULT_TEACHER_PASSWORD}.`, "success");
    } else {
      toast(res.error ?? "Reset failed", "error");
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/teachers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("teachers.backToTeachers")}
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white">
          {teacher.fullName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{teacher.fullName}</h1>
            <Badge tone={STATUS_TONE[teacher.status]} dot>
              {statusLabel(teacher.status)}
            </Badge>
            <Badge tone="info">{shiftLabel(teacher.shift)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{teacher.code}</span> · {money(teacher.salary)}{t("teachers.mo")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="me-2 h-4 w-4" /> {t("teachers.edit")}
          </Button>
          <Button variant="outline" onClick={() => printTeacherProfile(teacher, assignments)}>
            <Printer className="me-2 h-4 w-4" /> {t("teachers.print")}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              exportTeachersCsv([teacher], assignments, DEFAULT_TEACHER_EXPORT_FIELDS, `${teacher.code}.csv`)
            }
          >
            <Download className="me-2 h-4 w-4" /> {t("teachers.download")}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <Tabs tabs={TAB_LIST} active={tab} onChange={setTab} className="px-2" />
        <div className="p-6">
          {tab === "personal" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("teachers.teacherId")} value={<span className="font-mono">{teacher.code}</span>} />
              <Field label={t("teachers.fullName")} value={teacher.fullName} />
              <Field label={t("teachers.gender")} value={genderLabel(teacher.gender)} />
              <Field label={t("teachers.phone")} value={teacher.phone} />
              <Field label={t("teachers.email")} value={teacher.email ?? "—"} />
              <Field label={t("teachers.address")} value={teacher.address ?? "—"} />
              <Field label={t("teachers.qualification")} value={teacher.qualification ?? "—"} />
              <Field label={t("teachers.salary")} value={money(teacher.salary)} />
              <Field label={t("teachers.shift")} value={shiftLabel(teacher.shift)} />
              <Field label={t("teachers.employmentStatus")} value={statusLabel(teacher.status)} />
              <Field label={t("teachers.registrationDate")} value={longDate(teacher.registrationDate)} />
            </div>
          )}

          {tab === "login" && (
            <div className="max-w-md space-y-4">
              <Field label={t("teachers.username")} value={<span className="font-mono">{teacher.username}</span>} />
              <div className="space-y-2">
                <Label>{t("teachers.password")}</Label>
                <Input
                  type="text"
                  className="font-mono"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("teachers.defaultSamplePasswordIs")} {DEFAULT_TEACHER_PASSWORD}{t("teachers.passwordIsShownInPlainText")}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("teachers.onlyActiveTeachersMayLogIn")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleSavePassword()} disabled={savingPassword}>
                  <KeyRound className="me-2 h-4 w-4" />
                  {savingPassword ? "Saving…" : "Save Password"}
                </Button>
                <Button variant="outline" onClick={() => void handleResetPassword()}>
                  {t("teachers.resetTo")} {DEFAULT_TEACHER_PASSWORD}
                </Button>
              </div>
            </div>
          )}

          {tab === "assignments" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {assignments.length} {t("teachers.subjectAssignment")}
                  {assignments.length === 1 ? "" : "s"} {t("teachers.across")} {grouped.length}{" "}
                  {t("teachers.classSectionSlot")}
                  {grouped.length === 1 ? "" : "s"}{t("teachers.onlyThisTeacherAposSWorkload")}
                </p>
                <Button
                  onClick={() => {
                    setEditAssign(null);
                    setAssignOpen(true);
                  }}
                >
                  {t("teachers.assignSubjects")}
                </Button>
              </div>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-start text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">{t("teachers.academicYear")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("teachers.class")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("teachers.section")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("teachers.subjects")}</th>
                      <th className="px-4 py-2.5 text-end font-medium">
                        {t("teachers.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          {t("teachers.noAssignmentsYetUseAssignSubjects")}
                        </td>
                      </tr>
                    ) : (
                      grouped.map((g) => (
                        <tr
                          key={`${g.academicYear}-${g.className}-${g.section ?? "all"}`}
                          className="border-t"
                        >
                          <td className="px-4 py-2.5">{g.academicYear}</td>
                          <td className="px-4 py-2.5">{g.className}</td>
                          <td className="px-4 py-2.5">
                            {sectionLabel(g.section)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {g.subjects.map((sub) => (
                                <Badge key={sub} tone="info">
                                  {sub}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-end text-xs text-muted-foreground">
                            {g.subjects.length} {t("teachers.subject")}
                            {g.subjects.length === 1 ? "" : "s"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {assignments.length > 0 ? (
                <div className="overflow-hidden rounded-xl border">
                  <p className="border-b bg-secondary/40 px-4 py-2 text-xs font-medium text-muted-foreground">
                    {t("teachers.individualAssignmentRowsEditOrRemove")}
                  </p>
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-start text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">{t("teachers.year")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("teachers.class")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("teachers.section")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("teachers.shift")}</th>
                        <th className="px-4 py-2.5 font-medium">{t("teachers.subject")}</th>
                        <th className="px-4 py-2.5 text-end font-medium">
                          {t("teachers.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((a) => (
                        <tr key={a.id} className="border-t">
                          <td className="px-4 py-2.5">{a.academicYear}</td>
                          <td className="px-4 py-2.5">{a.className}</td>
                          <td className="px-4 py-2.5">
                            {sectionLabel(a.section)}
                          </td>
                          <td className="px-4 py-2.5">
                            {assignmentShiftLabel(a.shift, teacher.shift)}
                          </td>
                          <td className="px-4 py-2.5">{a.subject}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditAssign(a);
                                  setAssignOpen(true);
                                }}
                                className="rounded-lg px-2 py-1 text-xs hover:bg-secondary"
                              >
                                {t("teachers.edit")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteAssign(a)}
                                className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-500/10"
                              >
                                {t("teachers.remove")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          {tab === "attendance" && <AttendanceTab teacherId={teacher.id} />}
          {tab === "exams" && <ExamsTab teacherId={teacher.id} />}
          {tab === "quizzes" && <QuizzesTab teacherId={teacher.id} />}
          {tab === "salary" && <SalaryTab teacherId={teacher.id} />}
        </div>
      </div>

      <TeacherFormDialog open={editOpen} onClose={() => setEditOpen(false)} teacher={teacher} onSaved={(m) => toast(m)} />
      <AssignmentFormDialog
        open={assignOpen}
        onClose={() => { setAssignOpen(false); setEditAssign(null); }}
        teacherId={teacher.id}
        assignment={editAssign}
        onSaved={(m) => toast(m)}
      />
      <ConfirmDialog
        open={!!deleteAssign}
        title={t("teachers.removeAssignment")}
        message={deleteAssign ? `Remove ${deleteAssign.subject} from ${deleteAssign.className}?` : ""}
        confirmLabel={t("teachers.remove")}
        onConfirm={async () => {
          if (deleteAssign) {
            const res = await deleteAssignment(deleteAssign.id);
            toast(res.ok ? "Assignment removed." : res.error ?? "Failed", res.ok ? "success" : "error");
          }
          setDeleteAssign(null);
        }}
        onClose={() => setDeleteAssign(null)}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-secondary/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function AttendanceTab({ teacherId }: { teacherId: string }) {
  const t = useT();
  const teacher = getTeacher(teacherId)!;
  const a = useMemo(() => teacherAttendanceHistory(teacher), [teacher]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("teachers.present")} value={a.present} />
        <Stat label={t("teachers.absent")} value={a.absent} />
        <Stat label={t("teachers.late")} value={a.late} />
        <Stat label={t("teachers.attendance")} value={`${a.percentage}%`} />
      </div>
      <DataTable
        headers={["Date", "Status"]}
        rows={a.rows.map((r) => [shortDate(r.date), statusLabel(r.status)])}
      />
    </div>
  );
}

function ExamsTab({ teacherId }: { teacherId: string }) {
  const t = useT();
  useExaminationsState();
  const exams = useMemo(() => teacherExams(teacherId), [teacherId]);
  const monitoring = useMemo(() => {
    const all = monitoringRows();
    const teacher = getTeacher(teacherId);
    if (!teacher) return [];
    return all.filter((r) => r.teacherName === teacher.fullName);
  }, [teacherId]);
  const submitted = monitoring.filter((r) => r.status === "SUBMITTED").length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("teachers.examsAssigned")} value={exams.length} />
        <Stat label={t("teachers.submitted")} value={submitted} />
        <Stat label={t("teachers.pending")} value={monitoring.length - submitted} />
      </div>
      <DataTable
        headers={["Exam", "Class", "Section", "Subject", "Status"]}
        rows={monitoring.map((r) => [
          r.examName,
          r.className,
          r.section,
          r.subject,
          r.status,
        ])}
      />
    </div>
  );
}

function QuizzesTab({ teacherId }: { teacherId: string }) {
  const t = useT();
  const rows = useMemo(() => teacherQuizSummary(teacherId), [teacherId]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat label={t("teachers.created")} value={rows.length} />
        <Stat label={t("teachers.active")} value={rows.filter((r) => r.status === "ACTIVE").length} />
        <Stat label={t("teachers.completed")} value={rows.filter((r) => ["CLOSED", "PUBLISHED"].includes(r.status)).length} />
        <Stat label={t("teachers.avgScore")} value={rows.length ? `${Math.round(rows.reduce((s, r) => s + r.averageScore, 0) / rows.length)}%` : "—"} />
      </div>
      <DataTable
        headers={["Quiz", "Status", "Attempts", "Avg Score", "Created"]}
        rows={rows.map((r) => [r.name, r.status, r.attempts, `${Math.round(r.averageScore)}%`, shortDate(r.createdAt)])}
      />
    </div>
  );
}

function SalaryTab({ teacherId }: { teacherId: string }) {
  const t = useT();
  const [payslip, setPayslip] = useState<PayrollRecord | null>(null);
  const rows = useMemo(() => {
    const emp = getEmployee(teacherId);
    if (!emp) return [];
    return employeePayrollHistory(emp.id);
  }, [teacherId]);

  if (!getEmployee(teacherId)) {
    return (
      <p className="rounded-xl border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
        {t("teachers.noSalaryProfileLinkedToThis")}
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-start text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("teachers.month")}</th>
              <th className="px-4 py-2.5 font-medium">{t("teachers.netSalary")}</th>
              <th className="px-4 py-2.5 font-medium">{t("teachers.paid")}</th>
              <th className="px-4 py-2.5 font-medium">{t("teachers.balance")}</th>
              <th className="px-4 py-2.5 font-medium">{t("teachers.status")}</th>
              <th className="px-4 py-2.5 font-medium">{t("teachers.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {t("teachers.noPayrollRecordsYet")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2.5">{monthLabel(r.payrollMonth)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(r.netSalary)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(r.amountPaid)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(r.remainingBalance)}</td>
                  <td className="px-4 py-2.5">
                    <PayrollStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => setPayslip(r)}
                      >
                        {t("teachers.view")}
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => printPayslip(r)}
                      >
                        {t("teachers.print")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <PayslipDialog payroll={payslip} onClose={() => setPayslip(null)} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-secondary/30 p-4 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-start text-xs text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
