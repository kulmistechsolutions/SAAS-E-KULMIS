"use client";


import { useT } from "@/lib/i18n/provider";
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
import { StudentAvatar } from "@/components/students/student-avatar";
import { useStudentsState, withParents, ensureStudentLoaded } from "@/lib/students/store";
import { genderLabel, longDate, money, shortDate, statusLabel } from "@/lib/students/format";
import { exportStudentsCsv, printStudentProfile } from "@/lib/students/print";
import { FeeStatusBadge } from "@/components/fees/fee-status-badge";
import { apiStudentLedger, type ApiStudentLedger } from "@/lib/fees/api";
import { monthKey, monthLabel, money as feeMoney } from "@/lib/fees/format";
import {
  buildExamGroupBreakdown,
  fetchStudentFinalResult,
  isStudentBlocked,
  useExaminationsState,
} from "@/lib/examinations/store";
import type {
  StudentExamResult,
  StudentFinalResult,
} from "@/lib/examinations/types";
import { Dialog } from "@/components/ui/dialog";
import { ExamResultCard } from "@/components/examinations/exam-result-card";
import { attendanceHistory, loadAttendanceHistory, type AttendanceSummary } from "@/lib/students/history";
import { studentQuizHistory } from "@/lib/quiz/store";
import { studentPromotionHistory } from "@/lib/promotions/store";
import { PromotionTypeBadge } from "@/components/promotions/badges";
import { dateTime } from "@/lib/promotions/format";
import type { StudentStatus, StudentWithParent } from "@/lib/students/types";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<StudentStatus, "success" | "muted" | "info"> = {
  ACTIVE: "success",
  INACTIVE: "muted",
  GRADUATED: "info",
};

function buildTabs(tr: ReturnType<typeof useT>) {
  const all = [
    { id: "personal", label: tr("students.tabPersonal"), icon: <User className="h-4 w-4" /> },
    { id: "parent", label: tr("students.tabParent"), icon: <Users className="h-4 w-4" /> },
    { id: "attendance", label: tr("students.tabAttendance"), icon: <CalendarCheck className="h-4 w-4" /> },
    { id: "fees", label: tr("students.tabFees"), icon: <Receipt className="h-4 w-4" /> },
    { id: "exams", label: tr("students.tabExams"), icon: <FileText className="h-4 w-4" /> },
    { id: "quizzes", label: tr("students.tabQuizzes"), icon: <GraduationCap className="h-4 w-4" /> },
    { id: "promotion", label: tr("students.tabPromotion"), icon: <TrendingUp className="h-4 w-4" /> },
  ];
  return { all, teacher: all.filter((t) => t.id !== "fees" && t.id !== "promotion") };
}

export default function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tr = useT();
  const { id } = use(params);
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const { all: allTabs, teacher: teacherTabs } = buildTabs(tr);
  const TABS = isTeacher ? teacherTabs : allTabs;
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    void ensureStudentLoaded(id).finally(() => setLoading(false));
  }, [mounted, id]);

  const state = useStudentsState();
  const student = useMemo(
    () => withParents(state).find((s) => s.id === id) ?? null,
    [state, id],
  );

  const [tab, setTab] = useState("personal");
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (isTeacher && (tab === "fees" || tab === "promotion")) {
      setTab("personal");
    }
  }, [isTeacher, tab]);

  if (!mounted || loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {tr("students.loadingProfile")}
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Link
          href={isTeacher ? "/my-students" : "/students"}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />{" "}
          {isTeacher ? tr("students.backToMyStudents") : tr("students.backToStudents")}
        </Link>
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          {tr("students.studentNotFoundItMayHave")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={isTeacher ? "/my-students" : "/students"}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />{" "}
        {isTeacher ? tr("students.backToMyStudents") : tr("students.backToStudents")}
      </Link>

      {/* Header card */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent px-6 py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <StudentAvatar
              name={student.fullName}
              studentId={student.id}
              hasPhoto={student.hasPhoto}
              photoUrl={student.photoUrl}
              size="xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                  {student.fullName}
                </h1>
                <Badge tone={STATUS_TONE[student.status]} dot>
                  {statusLabel(student.status)}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-mono">{student.code}</span> ·{" "}
                {student.className}
                {student.section ? ` · ${tr("students.section")} ${student.section}` : ""} ·{" "}
                {genderLabel(student.gender)}
              </p>
              {student.hasPhoto || student.photoUrl ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {tr("students.clickThePhotoToViewFull")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {!isTeacher && (
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="me-2 h-4 w-4" /> {tr("students.edit")}
                </Button>
              )}
              <Button variant="outline" onClick={() => printStudentProfile(student)}>
                <Printer className="me-2 h-4 w-4" /> {tr("students.print")}
              </Button>
              <Button
                variant="outline"
                onClick={() => exportStudentsCsv([student], `${student.code}.csv`)}
              >
                <Download className="me-2 h-4 w-4" /> {tr("students.download")}
              </Button>
            </div>
          </div>
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

      {!isTeacher && (
        <StudentFormDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          student={student}
          onSaved={(msg, tone) => toast(msg, tone ?? "success")}
        />
      )}
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
  const tr = useT();
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 rounded-xl border bg-secondary/20 p-5 sm:flex-row sm:items-center">
        <StudentAvatar
          name={student.fullName}
          studentId={student.id}
          hasPhoto={student.hasPhoto}
          photoUrl={student.photoUrl}
          size="lg"
        />
        <div>
          <p className="text-sm font-medium text-foreground">{tr("students.profilePhoto")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {student.hasPhoto || student.photoUrl
              ? tr("students.photoOnFileClickToPreview")
              : tr("students.noPhotoUploadedUseEditToAdd")}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label={tr("students.studentId")} value={<span className="font-mono">{student.code}</span>} />
      <Field label={tr("students.fullName")} value={student.fullName} />
      <Field label={tr("students.gender")} value={genderLabel(student.gender)} />
      <Field label={tr("students.dateOfBirth")} value={shortDate(student.dob)} />
      <Field label={tr("students.phone")} value={student.phone ?? "—"} />
      {/* Only collected by the detailed registration form — hidden entirely
          rather than shown as an empty dash for schools that never use it. */}
      {student.placeOfBirth && (
        <Field label={tr("students.placeOfBirth")} value={student.placeOfBirth} />
      )}
      {student.district && (
        <Field label={tr("students.district")} value={student.district} />
      )}
      {student.motherName && (
        <Field label={tr("students.motherName")} value={student.motherName} />
      )}
      {student.village && (
        <Field label={tr("studentsStudentFormDialog.village")} value={student.village} />
      )}
      <Field label={tr("students.class")} value={student.className} />
      <Field label={tr("students.section")} value={student.section ?? "—"} />
      <Field label={tr("students.monthlyFee")} value={money(student.monthlyFee)} />
      <Field label={tr("students.academicYear")} value={student.academicYear} />
      <Field label={tr("students.registrationDate")} value={longDate(student.registrationDate)} />
      <Field label={tr("students.status")} value={statusLabel(student.status)} />
      <Field label={tr("students.notes")} value={student.notes ?? "—"} />
      </div>
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
  const tr = useT();
  const siblings = state.students.filter(
    (s) => s.parentId === student.parentId,
  );
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={tr("students.parentId")} value={<span className="font-mono">{student.parent.code}</span>} />
        <Field label={tr("students.parentName")} value={student.parent.name} />
        <Field label={tr("students.parentPhone")} value={student.parent.phone} />
        <Field label={tr("students.numberOfChildren")} value={siblings.length} />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">{tr("students.children")}</h3>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-start text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">{tr("students.studentId")}</th>
                <th className="px-4 py-2.5 font-medium">{tr("students.name")}</th>
                <th className="px-4 py-2.5 font-medium">{tr("students.class")}</th>
                <th className="px-4 py-2.5 font-medium">{tr("students.status")}</th>
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
  const tr = useT();
  const [a, setA] = useState<AttendanceSummary>(() => attendanceHistory(student));
  useEffect(() => {
    void loadAttendanceHistory(student.id, 60).then(setA);
  }, [student.id]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label={tr("students.present")} value={a.present} tone="bg-emerald-500/10" />
        <StatPill label={tr("students.absent")} value={a.absent} tone="bg-rose-500/10" />
        <StatPill label={tr("students.late")} value={a.late} tone="bg-amber-500/10" />
        <StatPill label={tr("students.attendance")} value={`${a.percentage}%`} tone="bg-sky-500/10" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-start text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{tr("students.date")}</th>
              <th className="px-4 py-2.5 font-medium">{tr("students.status")}</th>
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
  const tr = useT();
  const [ledger, setLedger] = useState<ApiStudentLedger | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiStudentLedger(student.id)
      .then((data) => {
        if (!cancelled) setLedger(data);
      })
      .catch(() => {
        if (!cancelled) setLedger(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [student.id]);

  const summary = ledger?.summary;
  const rows = ledger?.charges ?? [];
  const progressBlocks = summary
    ? Math.min(10, summary.totalMonths || 10)
    : 10;
  const filledBlocks = summary
    ? Math.round((summary.paidMonths / Math.max(summary.totalMonths, 1)) * progressBlocks)
    : 0;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tr("students.academicProgress")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.billingMode === "ACADEMIC_YEAR"
                  ? tr("students.academicYearBilling")
                  : tr("students.monthlyBilling")}
              </p>
            </div>
            <div className="text-end text-sm">
              <p className="tabular-nums">
                {tr("students.paid")} <span className="font-semibold">{feeMoney(summary.amountPaid)}</span>
              </p>
              <p className="tabular-nums text-rose-600">
                {tr("students.outstanding")} <span className="font-semibold">{feeMoney(summary.outstandingBalance)}</span>
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: progressBlocks }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-3 flex-1 rounded-sm",
                  i < filledBlocks ? "bg-emerald-500" : "bg-secondary",
                )}
              />
            ))}
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{tr("students.paidMonths")}</dt>
              <dd className="font-medium">
                {summary.paidMonths} / {summary.totalMonths}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{tr("students.outstandingMonths")}</dt>
              <dd className="font-medium">{summary.unpaidMonths}</dd>
            </div>
            {summary.billingMode === "ACADEMIC_YEAR" && (
              <div>
                <dt className="text-muted-foreground">{tr("students.annualFee")}</dt>
                <dd className="font-medium tabular-nums">{feeMoney(summary.totalAcademicFee)}</dd>
              </div>
            )}
            {summary.inactiveMonths > 0 && (
              <div>
                <dt className="text-muted-foreground">{tr("students.inactiveMonths")}</dt>
                <dd className="font-medium">{summary.inactiveMonths}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-start text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{tr("students.month")}</th>
              <th className="px-4 py-2.5 font-medium">{tr("students.monthlyCharge")}</th>
              <th className="px-4 py-2.5 font-medium">{tr("students.amountPaid")}</th>
              <th className="px-4 py-2.5 font-medium">{tr("students.remainingBalance")}</th>
              <th className="px-4 py-2.5 font-medium">{tr("students.status")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {tr("students.loadingFeeRecords")}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2.5">
                    {r.kind && r.kind !== "MONTHLY" && r.label
                      ? `${r.label} · ${monthLabel(monthKey(r.year, r.month))}`
                      : monthLabel(monthKey(r.year, r.month))}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{feeMoney(r.amount)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{feeMoney(r.paidAmount)}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {feeMoney(Math.max(0, r.amount - r.paidAmount))}
                  </td>
                  <td className="px-4 py-2.5">
                    <FeeStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {tr("students.noFeeRecordsYet")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExamsTab({ student }: { student: StudentWithParent }) {
  const tr = useT();
  // Blocked status still comes from the exam store, but the published results
  // themselves are read straight from the API — the student profile never
  // hydrates the full exams+marks store, so the old store-only lookup always
  // came back empty even when results were published (see class Results page).
  useExaminationsState();
  const blocked = isStudentBlocked(student.id);
  const [result, setResult] = useState<StudentFinalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<StudentExamResult | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchStudentFinalResult(student.id, student.academicYear)
      .then((r) => {
        if (active) setResult(r);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [student.id, student.academicYear]);

  const rows = result?.termResults ?? [];

  const groupBreakdown = useMemo(
    () =>
      viewing?.examGroupId && result
        ? buildExamGroupBreakdown(result, viewing.examGroupId)
        : null,
    [viewing, result],
  );

  if (blocked) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        {tr("students.resultsAreBlockedContactTheSchool")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-start text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{tr("students.exam")}</th>
              <th className="px-4 py-2.5 font-medium">{tr("students.term")}</th>
              <th className="px-4 py-2.5 font-medium">{tr("students.total")}</th>
              <th className="px-4 py-2.5 font-medium">{tr("students.average")}</th>
              <th className="px-4 py-2.5 font-medium">{tr("students.grade")}</th>
              <th className="px-4 py-2.5 font-medium">{tr("students.result")}</th>
              <th className="px-4 py-2.5 text-end font-medium">{tr("students.card")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.examId} className="border-t">
                <td className="px-4 py-2.5">
                  {r.examName}
                  {r.examGroupName ? (
                    <span className="ms-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {r.examGroupName}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5">{r.term}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.totalObtained}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.average.toFixed(1)}</td>
                <td className="px-4 py-2.5 font-semibold">{r.grade}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={r.passed ? "success" : "danger"}>
                    {r.passed ? tr("students.pass") : tr("students.fail")}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-end">
                  <button
                    type="button"
                    onClick={() => setViewing(r)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {tr("students.view")}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {loading ? tr("students.loadingResults") : tr("students.noPublishedExamResultsYet")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {result && rows.length > 0 && (
        <div className="rounded-xl border bg-primary/5 p-4">
          <p className="text-sm font-medium text-muted-foreground">{tr("students.finalAcademicResult")}</p>
          <p className="mt-1 text-xl font-bold">
            {result.finalGrade} · {result.finalAverage.toFixed(1)}%
          </p>
          <Badge tone={result.passed ? "success" : "danger"} className="mt-2">
            {result.passed ? tr("students.pass") : tr("students.fail")}
          </Badge>
        </div>
      )}

      <Dialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={tr("students.examResultCard")}
        className={groupBreakdown ? "sm:max-w-4xl" : "sm:max-w-2xl"}
      >
        {viewing && result ? (
          <ExamResultCard
            data={
              groupBreakdown
                ? {
                    studentName: result.studentName,
                    studentCode: result.studentCode,
                    className: result.className,
                    section: result.section,
                    academicYear: result.academicYear,
                    examName: groupBreakdown.groupName,
                    subjects: [],
                    totalObtained: groupBreakdown.totalObtained,
                    totalMax: groupBreakdown.totalMax,
                    average: groupBreakdown.average,
                    grade: groupBreakdown.grade,
                    passed: groupBreakdown.passed,
                    group: {
                      examColumns: groupBreakdown.examColumns,
                      subjectRows: groupBreakdown.subjectRows,
                    },
                  }
                : {
                    studentName: result.studentName,
                    studentCode: result.studentCode,
                    className: result.className,
                    section: result.section,
                    academicYear: result.academicYear,
                    examName: viewing.examName,
                    term: viewing.term,
                    subjects: viewing.subjects,
                    totalObtained: viewing.totalObtained,
                    totalMax: viewing.totalMax,
                    average: viewing.average,
                    grade: viewing.grade,
                    passed: viewing.passed,
                  }
            }
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function QuizzesTab({ student }: { student: StudentWithParent }) {
  const tr = useT();
  const rows = useMemo(() => studentQuizHistory(student.id), [student.id]);
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-start text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{tr("students.quiz")}</th>
            <th className="px-4 py-2.5 font-medium">{tr("students.score")}</th>
            <th className="px-4 py-2.5 font-medium">{tr("students.percentage")}</th>
            <th className="px-4 py-2.5 font-medium">{tr("students.status")}</th>
            <th className="px-4 py-2.5 font-medium">{tr("students.attemptDate")}</th>
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
  const tr = useT();
  const rows = useMemo(() => studentPromotionHistory(student.id), [student.id]);
  if (rows.length === 0)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tr("students.noPromotionHistoryYet")}
      </p>
    );
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-start text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{tr("students.type")}</th>
            <th className="px-4 py-2.5 font-medium">{tr("students.academicYear")}</th>
            <th className="px-4 py-2.5 font-medium">{tr("students.previousClass")}</th>
            <th className="px-4 py-2.5 font-medium">{tr("students.newClass")}</th>
            <th className="px-4 py-2.5 font-medium">{tr("students.promotionDate")}</th>
            <th className="px-4 py-2.5 font-medium">{tr("students.by")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.rolledBackAt ? "border-t opacity-50" : "border-t"}>
              <td className="px-4 py-2.5"><PromotionTypeBadge type={r.type} /></td>
              <td className="px-4 py-2.5">{r.fromAcademicYear}</td>
              <td className="px-4 py-2.5">{r.fromClass}{r.fromSection ? ` (${r.fromSection})` : ""}</td>
              <td className="px-4 py-2.5">
                {r.graduated ? tr("students.graduated") : `${r.toClass}${r.toSection ? ` (${r.toSection})` : ""}`}
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
