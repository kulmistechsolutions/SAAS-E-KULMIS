"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck,
  Download,
  FileText,
  GraduationCap,
  Pencil,
  Printer,
  Receipt,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { StudentFormDialog } from "@/components/students/student-form-dialog";
import { useStudentsState, withParents } from "@/lib/students/store";
import { genderLabel, longDate, money, shortDate, statusLabel } from "@/lib/students/format";
import { exportStudentsCsv, printStudentProfile } from "@/lib/students/print";
import { FeeStatusBadge } from "@/components/fees/fee-status-badge";
import { studentLedger, useFeesState } from "@/lib/fees/store";
import {
  isStudentBlocked,
  studentFinalResult,
  studentPublishedResults,
  useExaminationsState,
} from "@/lib/examinations/store";
import { attendanceHistory } from "@/lib/students/history";
import { studentQuizHistory } from "@/lib/quiz/store";
import { studentPromotionHistory } from "@/lib/promotions/store";
import { PromotionTypeBadge } from "@/components/promotions/badges";
import { dateTime } from "@/lib/promotions/format";
import type { StudentStatus, StudentWithParent } from "@/lib/students/types";
import { toast } from "@/lib/toast";

const STATUS_TONE: Record<StudentStatus, "success" | "muted" | "info"> = {
  ACTIVE: "success",
  INACTIVE: "muted",
  GRADUATED: "info",
};

const TABS = [
  { id: "personal", label: "Personal", icon: <User className="h-4 w-4" /> },
  { id: "parent", label: "Parent", icon: <Users className="h-4 w-4" /> },
  { id: "attendance", label: "Attendance", icon: <CalendarCheck className="h-4 w-4" /> },
  { id: "fees", label: "Fees", icon: <Receipt className="h-4 w-4" /> },
  { id: "exams", label: "Exams", icon: <FileText className="h-4 w-4" /> },
  { id: "quizzes", label: "Quizzes", icon: <GraduationCap className="h-4 w-4" /> },
  { id: "promotion", label: "Promotion", icon: <TrendingUp className="h-4 w-4" /> },
];

export default function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const state = useStudentsState();
  const student = useMemo(
    () => withParents(state).find((s) => s.id === id) ?? null,
    [state, id],
  );

  const [tab, setTab] = useState("personal");
  const [editOpen, setEditOpen] = useState(false);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading profile…
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Link
          href="/students"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Students
        </Link>
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          Student not found. It may have been deleted.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/students"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Students
      </Link>

      {/* Header card */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white">
          {student.fullName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {student.fullName}
            </h1>
            <Badge tone={STATUS_TONE[student.status]} dot>
              {statusLabel(student.status)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{student.code}</span> ·{" "}
            {student.className}
            {student.section ? ` - ${student.section}` : ""} ·{" "}
            {genderLabel(student.gender)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" onClick={() => printStudentProfile(student)}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button
            variant="outline"
            onClick={() => exportStudentsCsv([student], `${student.code}.csv`)}
          >
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="px-2" />
        <div className="p-6">
          {tab === "personal" && <PersonalTab student={student} />}
          {tab === "parent" && <ParentTab student={student} state={state} />}
          {tab === "attendance" && <AttendanceTab student={student} />}
          {tab === "fees" && <FeesTab student={student} />}
          {tab === "exams" && <ExamsTab student={student} />}
          {tab === "quizzes" && <QuizzesTab student={student} />}
          {tab === "promotion" && <PromotionTab student={student} />}
        </div>
      </div>

      <StudentFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        student={student}
        onSaved={(msg) => toast(msg)}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-secondary/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}

function PersonalTab({ student }: { student: StudentWithParent }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Student ID" value={<span className="font-mono">{student.code}</span>} />
      <Field label="Full Name" value={student.fullName} />
      <Field label="Gender" value={genderLabel(student.gender)} />
      <Field label="Date of Birth" value={shortDate(student.dob)} />
      <Field label="Phone" value={student.phone ?? "—"} />
      <Field label="Class" value={student.className} />
      <Field label="Section" value={student.section ?? "—"} />
      <Field label="Monthly Fee" value={money(student.monthlyFee)} />
      <Field label="Academic Year" value={student.academicYear} />
      <Field label="Registration Date" value={longDate(student.registrationDate)} />
      <Field label="Status" value={statusLabel(student.status)} />
      <Field label="Notes" value={student.notes ?? "—"} />
    </div>
  );
}

function ParentTab({
  student,
  state,
}: {
  student: StudentWithParent;
  state: ReturnType<typeof useStudentsState>;
}) {
  const siblings = state.students.filter(
    (s) => s.parentId === student.parentId,
  );
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Parent ID" value={<span className="font-mono">{student.parent.code}</span>} />
        <Field label="Parent Name" value={student.parent.name} />
        <Field label="Parent Phone" value={student.parent.phone} />
        <Field label="Number of Children" value={siblings.length} />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Children</h3>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Student ID</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Class</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {siblings.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2.5 font-mono text-xs">{s.code}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/students/${s.id}`} className="hover:text-primary hover:underline">
                      {s.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {s.className}
                    {s.section ? ` - ${s.section}` : ""}
                  </td>
                  <td className="px-4 py-2.5">{statusLabel(s.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className={`rounded-xl border p-4 text-center ${tone}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function AttendanceTab({ student }: { student: StudentWithParent }) {
  const a = useMemo(() => attendanceHistory(student), [student]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="Present" value={a.present} tone="bg-emerald-500/10" />
        <StatPill label="Absent" value={a.absent} tone="bg-rose-500/10" />
        <StatPill label="Late" value={a.late} tone="bg-amber-500/10" />
        <StatPill label="Attendance %" value={`${a.percentage}%`} tone="bg-sky-500/10" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {a.rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2.5">{shortDate(r.date)}</td>
                <td className="px-4 py-2.5">
                  <Badge
                    tone={
                      r.status === "PRESENT"
                        ? "success"
                        : r.status === "LATE"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {statusLabel(r.status)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeesTab({ student }: { student: StudentWithParent }) {
  useFeesState();
  const rows = useMemo(() => studentLedger(student.id), [student.id]);
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Month</th>
            <th className="px-4 py-2.5 font-medium">Monthly Charge</th>
            <th className="px-4 py-2.5 font-medium">Amount Paid</th>
            <th className="px-4 py-2.5 font-medium">Remaining Balance</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Payment Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.chargeId} className="border-t">
              <td className="px-4 py-2.5">{r.monthLabel}</td>
              <td className="px-4 py-2.5 tabular-nums">{money(r.monthlyCharge)}</td>
              <td className="px-4 py-2.5 tabular-nums">{money(r.amountPaid)}</td>
              <td className="px-4 py-2.5 tabular-nums">{money(r.remainingBalance)}</td>
              <td className="px-4 py-2.5">
                <FeeStatusBadge status={r.status} />
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {shortDate(r.paymentDate)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                No fee records yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ExamsTab({ student }: { student: StudentWithParent }) {
  useExaminationsState();
  const blocked = isStudentBlocked(student.id);
  const rows = useMemo(
    () => studentPublishedResults(student.id),
    [student.id],
  );
  const finalResult = useMemo(
    () => studentFinalResult(student.id),
    [student.id],
  );

  if (blocked) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        Results are blocked. Contact the school office.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Exam</th>
              <th className="px-4 py-2.5 font-medium">Term</th>
              <th className="px-4 py-2.5 font-medium">Total</th>
              <th className="px-4 py-2.5 font-medium">Average</th>
              <th className="px-4 py-2.5 font-medium">Grade</th>
              <th className="px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.examId} className="border-t">
                <td className="px-4 py-2.5">{r.examName}</td>
                <td className="px-4 py-2.5">{r.term}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.totalObtained}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.average.toFixed(1)}</td>
                <td className="px-4 py-2.5 font-semibold">{r.grade}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={r.passed ? "success" : "danger"}>
                    {r.passed ? "Pass" : "Fail"}
                  </Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No published exam results yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {finalResult && (
        <div className="rounded-xl border bg-primary/5 p-4">
          <p className="text-sm font-medium text-muted-foreground">Final Academic Result</p>
          <p className="mt-1 text-xl font-bold">
            {finalResult.finalGrade} · {finalResult.finalAverage.toFixed(1)}%
          </p>
          <Badge tone={finalResult.passed ? "success" : "danger"} className="mt-2">
            {finalResult.passed ? "Pass" : "Fail"}
          </Badge>
        </div>
      )}
    </div>
  );
}

function QuizzesTab({ student }: { student: StudentWithParent }) {
  const rows = useMemo(() => studentQuizHistory(student.id), [student.id]);
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Quiz</th>
            <th className="px-4 py-2.5 font-medium">Score</th>
            <th className="px-4 py-2.5 font-medium">Percentage</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Attempt Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="px-4 py-2.5">{r.name}</td>
              <td className="px-4 py-2.5 tabular-nums">
                {r.score}/{r.total}
              </td>
              <td className="px-4 py-2.5 tabular-nums">{r.percentage}%</td>
              <td className="px-4 py-2.5">
                <Badge tone={r.status === "PASSED" ? "success" : "danger"}>
                  {statusLabel(r.status)}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {shortDate(r.date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PromotionTab({ student }: { student: StudentWithParent }) {
  const rows = useMemo(() => studentPromotionHistory(student.id), [student.id]);
  if (rows.length === 0)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No promotion history yet.
      </p>
    );
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Academic Year</th>
            <th className="px-4 py-2.5 font-medium">Previous Class</th>
            <th className="px-4 py-2.5 font-medium">New Class</th>
            <th className="px-4 py-2.5 font-medium">Promotion Date</th>
            <th className="px-4 py-2.5 font-medium">By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.rolledBackAt ? "border-t opacity-50" : "border-t"}>
              <td className="px-4 py-2.5"><PromotionTypeBadge type={r.type} /></td>
              <td className="px-4 py-2.5">{r.fromAcademicYear}</td>
              <td className="px-4 py-2.5">{r.fromClass}{r.fromSection ? ` (${r.fromSection})` : ""}</td>
              <td className="px-4 py-2.5">
                {r.graduated ? "Graduated" : `${r.toClass}${r.toSection ? ` (${r.toSection})` : ""}`}
                {r.rolledBackAt ? " — rolled back" : ""}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{dateTime(r.promotedAt)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{r.promotedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
