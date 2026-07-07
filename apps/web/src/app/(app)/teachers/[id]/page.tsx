"use client";

import { use, useEffect, useMemo, useState } from "react";
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
  resetTeacherPassword,
  teacherAssignments,
  useTeachersState,
} from "@/lib/teachers/store";
import {
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
import { exportTeachersCsv, printTeacherProfile } from "@/lib/teachers/print";
import type { EmploymentStatus, TeacherAssignment } from "@/lib/teachers/types";
import { toast } from "@/lib/toast";

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
  const { id } = use(params);
  const search = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const state = useTeachersState();
  const teacher = useMemo(() => getTeacher(id), [state, id]);
  const assignments = useMemo(
    () => (teacher ? teacherAssignments(teacher.id) : []),
    [state.assignments, teacher],
  );

  const [tab, setTab] = useState(search.get("tab") ?? "personal");
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editAssign, setEditAssign] = useState<TeacherAssignment | null>(null);
  const [deleteAssign, setDeleteAssign] = useState<TeacherAssignment | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (!mounted) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading profile…</div>;
  }

  if (!teacher) {
    return (
      <div className="space-y-4">
        <Link href="/teachers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Teachers
        </Link>
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          Teacher not found.
        </div>
      </div>
    );
  }

  function handleResetPassword() {
    const res = resetTeacherPassword(teacher!.id);
    if (res.ok && res.password) {
      setShowPassword(true);
      toast(`New password: ${res.password}`, "info");
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/teachers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Teachers
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
            <span className="font-mono">{teacher.code}</span> · {money(teacher.salary)}/mo
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" onClick={() => printTeacherProfile(teacher, assignments)}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" onClick={() => exportTeachersCsv([teacher], `${teacher.code}.csv`)}>
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <Tabs tabs={TAB_LIST} active={tab} onChange={setTab} className="px-2" />
        <div className="p-6">
          {tab === "personal" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Teacher ID" value={<span className="font-mono">{teacher.code}</span>} />
              <Field label="Full Name" value={teacher.fullName} />
              <Field label="Gender" value={genderLabel(teacher.gender)} />
              <Field label="Phone" value={teacher.phone} />
              <Field label="Email" value={teacher.email ?? "—"} />
              <Field label="Address" value={teacher.address ?? "—"} />
              <Field label="Qualification" value={teacher.qualification ?? "—"} />
              <Field label="Salary" value={money(teacher.salary)} />
              <Field label="Shift" value={shiftLabel(teacher.shift)} />
              <Field label="Employment Status" value={statusLabel(teacher.status)} />
              <Field label="Registration Date" value={longDate(teacher.registrationDate)} />
            </div>
          )}

          {tab === "login" && (
            <div className="max-w-md space-y-4">
              <Field label="Username" value={<span className="font-mono">{teacher.username}</span>} />
              <Field
                label="Password"
                value={
                  <span className="font-mono">
                    {showPassword ? teacher.password : "••••••••••"}
                  </span>
                }
              />
              <p className="text-xs text-muted-foreground">
                Only active teachers may log in. Inactive teachers are blocked at the portal.
              </p>
              <Button onClick={handleResetPassword}>
                <KeyRound className="mr-2 h-4 w-4" /> Generate New Password
              </Button>
            </div>
          )}

          {tab === "assignments" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => { setEditAssign(null); setAssignOpen(true); }}>
                  Assign Subject
                </Button>
              </div>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Academic Year</th>
                      <th className="px-4 py-2.5 font-medium">Class</th>
                      <th className="px-4 py-2.5 font-medium">Section</th>
                      <th className="px-4 py-2.5 font-medium">Subject</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No assignments yet.</td></tr>
                    ) : (
                      assignments.map((a) => (
                        <tr key={a.id} className="border-t">
                          <td className="px-4 py-2.5">{a.academicYear}</td>
                          <td className="px-4 py-2.5">{a.className}</td>
                          <td className="px-4 py-2.5">{sectionLabel(a.section)}</td>
                          <td className="px-4 py-2.5">{a.subject}</td>
                          <td className="px-4 py-2.5">
                            <Badge tone={a.status === "ACTIVE" ? "success" : "muted"}>{statusLabel(a.status)}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => { setEditAssign(a); setAssignOpen(true); }} className="rounded-lg px-2 py-1 text-xs hover:bg-secondary">Edit</button>
                              <button onClick={() => setDeleteAssign(a)} className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-500/10">Remove</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
        title="Remove Assignment"
        message={deleteAssign ? `Remove ${deleteAssign.subject} from ${deleteAssign.className}?` : ""}
        confirmLabel="Remove"
        onConfirm={() => {
          if (deleteAssign) {
            deleteAssignment(deleteAssign.id);
            toast("Assignment removed.");
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
  const teacher = getTeacher(teacherId)!;
  const a = useMemo(() => teacherAttendanceHistory(teacher), [teacher]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Present" value={a.present} />
        <Stat label="Absent" value={a.absent} />
        <Stat label="Late" value={a.late} />
        <Stat label="Attendance %" value={`${a.percentage}%`} />
      </div>
      <DataTable
        headers={["Date", "Status"]}
        rows={a.rows.map((r) => [shortDate(r.date), statusLabel(r.status)])}
      />
    </div>
  );
}

function ExamsTab({ teacherId }: { teacherId: string }) {
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
        <Stat label="Exams Assigned" value={exams.length} />
        <Stat label="Submitted" value={submitted} />
        <Stat label="Pending" value={monitoring.length - submitted} />
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
  const rows = useMemo(() => teacherQuizSummary(teacherId), [teacherId]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Created" value={rows.length} />
        <Stat label="Active" value={rows.filter((r) => r.status === "ACTIVE").length} />
        <Stat label="Completed" value={rows.filter((r) => ["CLOSED", "PUBLISHED"].includes(r.status)).length} />
        <Stat label="Avg Score" value={rows.length ? `${Math.round(rows.reduce((s, r) => s + r.averageScore, 0) / rows.length)}%` : "—"} />
      </div>
      <DataTable
        headers={["Quiz", "Status", "Attempts", "Avg Score", "Created"]}
        rows={rows.map((r) => [r.name, r.status, r.attempts, `${Math.round(r.averageScore)}%`, shortDate(r.createdAt)])}
      />
    </div>
  );
}

function SalaryTab({ teacherId }: { teacherId: string }) {
  const [payslip, setPayslip] = useState<PayrollRecord | null>(null);
  const rows = useMemo(() => {
    const emp = getEmployee(teacherId);
    if (!emp) return [];
    return employeePayrollHistory(emp.id);
  }, [teacherId]);

  if (!getEmployee(teacherId)) {
    return (
      <p className="rounded-xl border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
        No salary profile linked to this teacher yet.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Month</th>
              <th className="px-4 py-2.5 font-medium">Net Salary</th>
              <th className="px-4 py-2.5 font-medium">Paid</th>
              <th className="px-4 py-2.5 font-medium">Balance</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No payroll records yet.
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
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => printPayslip(r)}
                      >
                        Print
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
        <thead className="bg-secondary text-left text-xs text-muted-foreground">
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
