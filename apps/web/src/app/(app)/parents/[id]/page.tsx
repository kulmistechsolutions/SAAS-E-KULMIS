"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Download,
  KeyRound,
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
import { ParentDashboardCards } from "@/components/parents/summary-cards";
import { ParentFormDialog } from "@/components/parents/parent-form-dialog";
import { ChildSelector } from "@/components/parents/child-selector";
import {
  getParentWithChildren,
  parentDashboard,
  resetParentPassword,
  useStudentsState,
} from "@/lib/students/store";
import { genderLabel, longDate, money, shortDate, statusLabel } from "@/lib/students/format";
import {
  attendanceHistory,
  examHistory,
  feeHistory,
  parentPaymentHistory,
  promotionHistory,
  quizHistory,
} from "@/lib/parents/history";
import { printParentProfile, exportParentsCsv } from "@/lib/parents/print";
import type { ParentStatus, Student } from "@/lib/students/types";
import { toast } from "@/lib/toast";

const STATUS_TONE: Record<ParentStatus, "success" | "muted"> = {
  ACTIVE: "success",
  INACTIVE: "muted",
};

const TABS = [
  { id: "personal", label: "Personal", icon: <User className="h-4 w-4" /> },
  { id: "children", label: "Children", icon: <Users className="h-4 w-4" /> },
  { id: "attendance", label: "Attendance", icon: <CalendarCheck className="h-4 w-4" /> },
  { id: "fees", label: "Fees", icon: <Receipt className="h-4 w-4" /> },
  { id: "exams", label: "Exams", icon: <BookOpen className="h-4 w-4" /> },
  { id: "quizzes", label: "Quizzes", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "progress", label: "Progress", icon: <TrendingUp className="h-4 w-4" /> },
];

export default function ParentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const state = useStudentsState();
  const parent = useMemo(() => getParentWithChildren(id), [state, id]);
  const dashboard = useMemo(
    () => (parent ? parentDashboard(parent.id, state) : null),
    [parent, state],
  );

  const [tab, setTab] = useState("personal");
  const [editOpen, setEditOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string>("");

  useEffect(() => {
    if (parent?.children[0]) setSelectedChild(parent.children[0].id);
  }, [parent]);

  const child = parent?.children.find((c) => c.id === selectedChild) ?? parent?.children[0];

  if (!mounted) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading profile…</div>;
  }

  if (!parent) {
    return (
      <div className="space-y-4">
        <Link href="/parents" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Parents
        </Link>
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">Parent not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/parents" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Parents
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-2xl font-bold text-white">
          {parent.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{parent.name}</h1>
            <Badge tone={STATUS_TONE[parent.status]} dot>{statusLabel(parent.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{parent.code}</span> · {parent.children.length} child{parent.children.length !== 1 ? "ren" : ""} · {parent.phone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
          <Button variant="outline" onClick={() => printParentProfile(parent, parent.children)}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button variant="outline" onClick={() => exportParentsCsv([{ ...parent, childCount: parent.children.length }], `${parent.code}.csv`)}><Download className="mr-2 h-4 w-4" /> Download</Button>
        </div>
      </div>

      {dashboard && <ParentDashboardCards summary={dashboard} />}

      <div className="rounded-2xl border bg-card shadow-sm">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="px-2" />
        <div className="p-6">
          {tab === "personal" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Parent ID" value={<span className="font-mono">{parent.code}</span>} />
              <Field label="Full Name" value={parent.name} />
              <Field label="Phone" value={parent.phone} />
              <Field label="Alternative Phone" value={parent.altPhone ?? "—"} />
              <Field label="Email" value={parent.email ?? "—"} />
              <Field label="Address" value={parent.address ?? "—"} />
              <Field label="Occupation" value={parent.occupation ?? "—"} />
              <Field label="Registration Date" value={longDate(parent.registrationDate)} />
              <Field label="Status" value={statusLabel(parent.status)} />
              <Field label="Username" value={<span className="font-mono">{parent.username}</span>} />
              <Field label="Login ID" value={<span className="font-mono">{parent.code}</span>} />
              <div className="rounded-xl border bg-secondary/30 px-4 py-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Password</p>
                <p className="mt-0.5 font-mono font-medium">{showPassword ? parent.password : "••••••••••"}</p>
                <Button className="mt-3 h-8 px-3 text-xs" onClick={() => {
                  void resetParentPassword(parent.id).then((res) => {
                    if (res.ok && res.password) {
                      setShowPassword(true);
                      toast(`New password: ${res.password}`, "info");
                    } else toast(res.error ?? "Reset failed", "error");
                  });
                }}>
                  <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                </Button>
              </div>
            </div>
          )}

          {tab === "children" && (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Student ID</th>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Class</th>
                    <th className="px-4 py-2.5 font-medium">Section</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {parent.children.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-4 py-2.5 font-mono text-xs">{c.code}</td>
                      <td className="px-4 py-2.5 font-medium">{c.fullName}</td>
                      <td className="px-4 py-2.5">{c.className}</td>
                      <td className="px-4 py-2.5">{c.section ?? "—"}</td>
                      <td className="px-4 py-2.5">{statusLabel(c.status)}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/students/${c.id}`} className="text-primary hover:underline">View Student Profile</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab !== "personal" && tab !== "children" && (
            <>
              <ChildSelector
                students={parent.children}
                selectedId={selectedChild}
                onChange={setSelectedChild}
                className="mb-4"
              />
              {child ? (
                <>
                  {tab === "attendance" && <AttendanceTab child={child} />}
                  {tab === "fees" && <FeesTab child={child} allChildren={parent.children} />}
                  {tab === "exams" && <ExamsTab child={child} />}
                  {tab === "quizzes" && <QuizzesTab child={child} />}
                  {tab === "progress" && <ProgressTab child={child} />}
                </>
              ) : (
                <p className="py-8 text-center text-muted-foreground">No children linked.</p>
              )}
            </>
          )}
        </div>
      </div>

      <ParentFormDialog open={editOpen} onClose={() => setEditOpen(false)} parent={parent} onSaved={(m) => toast(m)} />
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

function AttendanceTab({ child }: { child: Student }) {
  const a = useMemo(() => attendanceHistory(child), [child]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Present" value={a.present} />
        <Stat label="Absent" value={a.absent} />
        <Stat label="Late" value={a.late} />
        <Stat label="Attendance %" value={`${a.percentage}%`} />
      </div>
      <DataTable headers={["Date", "Status"]} rows={a.rows.map((r) => [shortDate(r.date), statusLabel(r.status)])} />
    </div>
  );
}

function FeesTab({ child, allChildren }: { child: Student; allChildren: Student[] }) {
  const fees = useMemo(() => feeHistory(child), [child]);
  const payments = useMemo(() => parentPaymentHistory(allChildren), [allChildren]);
  const outstanding = fees.reduce((s, f) => s + f.balance, 0);
  const paid = fees.reduce((s, f) => s + f.paid, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Monthly Fee" value={money(child.monthlyFee)} />
        <Stat label="Paid (recent)" value={money(paid)} />
        <Stat label="Outstanding" value={money(outstanding)} />
        <Stat label="Receipts" value={payments.length} />
      </div>
      <h3 className="text-sm font-semibold">Fee Ledger — {child.fullName}</h3>
      <DataTable
        headers={["Month", "Charged", "Paid", "Balance", "Status"]}
        rows={fees.map((f) => [f.month, money(f.charged), money(f.paid), money(f.balance), statusLabel(f.status)])}
      />
      <h3 className="text-sm font-semibold">Payment History (all children)</h3>
      <DataTable
        headers={["Receipt", "Student", "Amount", "Type", "Date"]}
        rows={payments.map((p) => [p.receiptNumber, p.studentName, money(p.amount), p.type, shortDate(p.paidAt)])}
      />
    </div>
  );
}

function ExamsTab({ child }: { child: Student }) {
  const rows = useMemo(() => examHistory(child), [child]);
  return (
    <DataTable
      headers={["Exam", "Term", "Total", "Average", "Grade", "Result"]}
      rows={rows.map((r) => [r.name, r.term, r.totalMarks, r.average, r.grade, r.passed ? "Pass" : "Fail"])}
    />
  );
}

function QuizzesTab({ child }: { child: Student }) {
  const rows = useMemo(() => quizHistory(child), [child]);
  return (
    <DataTable
      headers={["Quiz", "Score", "Percentage", "Status", "Date"]}
      rows={rows.map((r) => [r.name, `${r.score}/${r.total}`, `${r.percentage}%`, statusLabel(r.status), shortDate(r.date)])}
    />
  );
}

function ProgressTab({ child }: { child: Student }) {
  const promos = useMemo(() => promotionHistory(child), [child]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Current Class" value={`${child.className}${child.section ? ` - ${child.section}` : ""}`} />
        <Field label="Gender" value={genderLabel(child.gender)} />
        <Field label="Status" value={statusLabel(child.status)} />
      </div>
      <h3 className="text-sm font-semibold">Promotion History</h3>
      {promos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No promotion history yet.</p>
      ) : (
        <DataTable
          headers={["Academic Year", "From", "To", "Date"]}
          rows={promos.map((p) => [p.academicYear, p.fromClass, p.toClass, shortDate(p.date)])}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-secondary/30 p-4 text-center">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left text-xs text-muted-foreground">
          <tr>{headers.map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {row.map((cell, j) => <td key={j} className="px-4 py-2.5">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
