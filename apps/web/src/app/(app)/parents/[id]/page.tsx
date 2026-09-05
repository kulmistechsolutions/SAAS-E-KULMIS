"use client";


import { useT } from "@/lib/i18n/provider";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Trash2,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { ParentDashboardCards } from "@/components/parents/summary-cards";
import { ParentFormDialog } from "@/components/parents/parent-form-dialog";
import { ChildSelector } from "@/components/parents/child-selector";
import {
  deleteParent,
  getParentWithChildren,
  parentDashboard,
  resetParentPassword,
  useStudentsState,
} from "@/lib/students/store";
import {
  genderLabel,
  longDate,
  money,
  shortDate,
  statusLabel,
} from "@/lib/students/format";
import {
  attendanceHistory,
  quizHistory,
} from "@/lib/parents/history";
import { apiStudentLedger, type ApiStudentLedger } from "@/lib/fees/api";
import { apiStudentResults, type ApiStudentFinalResult } from "@/lib/examinations/api";
import { studentPromotionHistory } from "@/lib/promotions/store";
import { monthLabel } from "@/lib/fees/format";
import { printParentProfile, exportParentsCsv } from "@/lib/parents/print";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import type { ParentStatus, Student } from "@/lib/students/types";
import { toast } from "@/lib/toast";

const STATUS_TONE: Record<ParentStatus, "success" | "muted"> = {
  ACTIVE: "success",
  INACTIVE: "muted",
};

const TABS = [
  { id: "personal", label: "Personal", icon: <User className="h-4 w-4" /> },
  { id: "children", label: "Children", icon: <Users className="h-4 w-4" /> },
  {
    id: "attendance",
    label: "Attendance",
    icon: <CalendarCheck className="h-4 w-4" />,
  },
  { id: "fees", label: "Fees", icon: <Receipt className="h-4 w-4" /> },
  { id: "exams", label: "Exams", icon: <BookOpen className="h-4 w-4" /> },
  {
    id: "quizzes",
    label: "Quizzes",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    id: "progress",
    label: "Progress",
    icon: <TrendingUp className="h-4 w-4" />,
  },
];

export default function ParentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useT();
  const router = useRouter();
  const { id } = use(params);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const state = useStudentsState();
  const parent = useMemo(() => getParentWithChildren(id), [state, id]);

  // The family's real ledgers, loaded once for the whole page: the headline
  // cards and the Fees tab must not answer the same question differently.
  const [ledgers, setLedgers] = useState<Record<string, ApiStudentLedger>>({});
  const childIds = useMemo(
    () => (parent?.children ?? []).map((c) => c.id).join(","),
    [parent],
  );
  useEffect(() => {
    if (!childIds) return;
    let alive = true;
    Promise.all(
      childIds.split(",").map((cid) =>
        apiStudentLedger(cid)
          .then((l) => [cid, l] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (!alive) return;
      const next: Record<string, ApiStudentLedger> = {};
      for (const r of results) if (r) next[r[0]] = r[1];
      setLedgers(next);
    });
    return () => {
      alive = false;
    };
  }, [childIds]);

  const feeTotals = useMemo(() => {
    const loaded = Object.values(ledgers);
    if (loaded.length === 0) return undefined;
    return {
      outstanding: loaded.reduce((n, l) => n + l.outstanding, 0),
      paid: loaded.reduce(
        (n, l) =>
          n +
          l.charges
            .filter((c) => c.status !== "INACTIVE")
            .reduce((m, c) => m + c.paidAmount, 0),
        0,
      ),
    };
  }, [ledgers]);

  const dashboard = useMemo(
    () => (parent ? parentDashboard(parent.id, state, feeTotals) : null),
    [parent, state, feeTotals],
  );

  const [tab, setTab] = useState("personal");
  const [editOpen, setEditOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [customPw, setCustomPw] = useState("");
  const [resetting, setResetting] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!parent) return;
    setDeleting(true);
    const res = await deleteParent(parent.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (res.ok) {
      toast(`${parent.name} deleted`, "success");
      router.push("/parents");
    } else {
      toast(res.error ?? "Failed to delete parent", "error");
    }
  }

  async function handleResetPassword(custom?: string) {
    if (!parent) return;
    setResetting(true);
    const res = await resetParentPassword(parent.id, custom);
    setResetting(false);
    if (res.ok && res.password) {
      setShowPassword(true);
      setCustomPw("");
      toast(`New password: ${res.password}`, "info");
    } else toast(res.error ?? "Reset failed", "error");
  }

  useEffect(() => {
    if (parent?.children[0]) setSelectedChild(parent.children[0].id);
  }, [parent]);

  const child =
    parent?.children.find((c) => c.id === selectedChild) ?? parent?.children[0];

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("parents.loadingProfile")}
      </div>
    );
  }

  if (!parent) {
    return (
      <div className="space-y-4">
        <Link
          href="/parents"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("parents.backToParents")}
        </Link>
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          {t("parents.parentNotFound")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/parents"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("parents.backToParents")}
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-2xl font-bold text-white">
          {parent.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{parent.name}</h1>
            <Badge tone={STATUS_TONE[parent.status]} dot>
              {statusLabel(parent.status)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{parent.code}</span> ·{" "}
            {parent.children.length} {t("parents.child")}
            {parent.children.length !== 1 ? "ren" : ""} · {parent.phone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="me-2 h-4 w-4" /> {t("parents.edit")}
          </Button>
          <Button
            variant="outline"
            onClick={() => printParentProfile(parent, parent.children)}
          >
            <Printer className="me-2 h-4 w-4" /> {t("parents.print")}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              exportParentsCsv(
                [{ ...parent, childCount: parent.children.length }],
                undefined,
                `${parent.code}.csv`,
              )
            }
          >
            <Download className="me-2 h-4 w-4" /> {t("parents.download")}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="me-2 h-4 w-4" /> {t("parents.delete")}
          </Button>
        </div>
      </div>

      {dashboard && <ParentDashboardCards summary={dashboard} />}

      <div className="rounded-2xl border bg-card shadow-sm">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="px-2" />
        <div className="p-6">
          {tab === "personal" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label={t("parents.parentId")}
                value={<span className="font-mono">{parent.code}</span>}
              />
              <Field label={t("parents.fullName")} value={parent.name} />
              <Field label={t("parents.phone")} value={parent.phone} />
              <Field label={t("parents.alternativePhone")} value={parent.altPhone ?? "—"} />
              <Field label={t("parents.email")} value={parent.email ?? "—"} />
              <Field label={t("parents.address")} value={parent.address ?? "—"} />
              <Field label={t("parents.occupation")} value={parent.occupation ?? "—"} />
              <Field
                label={t("parents.registrationDate")}
                value={longDate(parent.registrationDate)}
              />
              <Field label={t("parents.status")} value={statusLabel(parent.status)} />
              <Field
                label={t("parents.username")}
                value={<span className="font-mono">{parent.username}</span>}
              />
              <Field
                label={t("parents.loginId")}
                value={<span className="font-mono">{parent.code}</span>}
              />
              <div className="rounded-xl border bg-secondary/30 px-4 py-3 sm:col-span-2">
                <p className="text-xs text-muted-foreground">{t("parents.password")}</p>
                <p className="mt-0.5 font-mono font-medium">
                  {showPassword ? parent.password : "••••••••••"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("parents.parentsStartOnTheDefault")}{" "}
                  <span className="font-mono">12345</span>{t("parents.resetReturnsThemToItOr")}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    className="h-8 px-3 text-xs"
                    disabled={resetting}
                    onClick={() => void handleResetPassword()}
                  >
                    <KeyRound className="me-2 h-4 w-4" />
                    {resetting ? "Resetting…" : "Reset to 12345"}
                  </Button>
                  <div className="flex gap-2">
                    <Input
                      className="h-8 w-40 text-sm"
                      placeholder={t("parents.customPassword")}
                      value={customPw}
                      onChange={(e) => setCustomPw(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      disabled={resetting || customPw.trim().length < 4}
                      onClick={() => void handleResetPassword(customPw.trim())}
                    >
                      {t("parents.set")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "children" && (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-start text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t("parents.studentId")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("parents.name")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("parents.class")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("parents.section")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("parents.status")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("parents.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {parent.children.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {c.code}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{c.fullName}</td>
                      <td className="px-4 py-2.5">{c.className}</td>
                      <td className="px-4 py-2.5">{c.section ?? "—"}</td>
                      <td className="px-4 py-2.5">{statusLabel(c.status)}</td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/students/${c.id}`}
                          className="text-primary hover:underline"
                        >
                          {t("parents.viewStudentProfile")}
                        </Link>
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
                  {tab === "fees" && (
                    <FeesTab
                      child={child}
                      allChildren={parent.children}
                      ledgers={ledgers}
                    />
                  )}
                  {tab === "exams" && <ExamsTab child={child} />}
                  {tab === "quizzes" && <QuizzesTab child={child} />}
                  {tab === "progress" && <ProgressTab child={child} />}
                </>
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  {t("parents.noChildrenLinked")}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <ParentFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        parent={parent}
        onSaved={(m) => toast(m)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={t("parents.deleteParent")}
        message={
          parent.children.length > 0
            ? t("parents.stillGuardianOfChildren", {
                name: parent.name,
                count: parent.children.length,
                names: parent.children.map((c) => c.fullName).join(", "),
              })
            : t("parents.deleteParentConfirm", { name: parent.name })
        }
        confirmLabel={
          parent.children.length > 0
            ? t("parents.close")
            : deleting
              ? t("parents.deleting")
              : t("parents.delete")
        }
        onConfirm={() =>
          parent.children.length > 0 ? setDeleteOpen(false) : void handleDelete()
        }
        onClose={() => setDeleteOpen(false)}
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

function AttendanceTab({ child }: { child: Student }) {
  const t = useT();
  const a = useMemo(() => attendanceHistory(child), [child]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("parents.present")} value={a.present} />
        <Stat label={t("parents.absent")} value={a.absent} />
        <Stat label={t("parents.late")} value={a.late} />
        <Stat label={t("parents.attendance")} value={`${a.percentage}%`} />
      </div>
      <DataTable
        headers={["Date", "Status"]}
        rows={a.rows.map((r) => [shortDate(r.date), statusLabel(r.status)])}
      />
    </div>
  );
}

/**
 * What this family has actually been charged, and what they have actually paid.
 *
 * Both tables on this tab used to be invented. The ledger was eight months
 * generated from the student's code with a random number generator, so a
 * school opened a parent and read months its own fee setup had never covered,
 * marked Paid or Partial at random. The receipts underneath were made up the
 * same way — "RCP-0110-03" was the student code with a counter after it, not
 * a receipt anybody had issued.
 *
 * Everything here now comes from /fees/ledger, which returns the charges the
 * school raised and the payments it took. A month the school never set up has
 * no charge, so it no longer appears at all — which is the whole point.
 */
function FeesTab({
  child,
  allChildren,
  ledgers,
}: {
  child: Student;
  allChildren: Student[];
  ledgers: Record<string, ApiStudentLedger>;
}) {
  const t = useT();
  const loading = Object.keys(ledgers).length === 0;

  const ledger = ledgers[child.id];

  // A voided charge is not money anybody owes, so it stays out of the table
  // and out of every total on it.
  const charges = useMemo(
    () => (ledger?.charges ?? []).filter((c) => c.status !== "INACTIVE"),
    [ledger],
  );

  const payments = useMemo(() => {
    const rows = allChildren.flatMap((c) =>
      (ledgers[c.id]?.payments ?? []).map((p) => ({ ...p, childName: c.fullName })),
    );
    return rows.sort(
      (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
    );
  }, [ledgers, allChildren]);

  const paid = charges.reduce((s, c) => s + c.paidAmount, 0);
  const outstanding = ledger?.outstanding ?? 0;

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("parents.loadingProfile")}</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={t("parents.monthlyFee")}
          value={money(ledger?.student.monthlyFee ?? child.monthlyFee)}
        />
        <Stat label={t("parents.paidRecent")} value={money(paid)} />
        <Stat label={t("parents.outstanding")} value={money(outstanding)} />
        <Stat label={t("parents.receipts")} value={payments.length} />
      </div>
      <h3 className="text-sm font-semibold">{t("parents.feeLedger")} {child.fullName}</h3>
      {charges.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("parents.noFeeMonthsSetUp")}
        </p>
      ) : (
        <DataTable
          headers={["Month", "Charged", "Paid", "Balance", "Status"]}
          rows={charges.map((c) => {
            const label = monthLabel(
              `${c.year}-${String(c.month).padStart(2, "0")}`,
            );
            return [
              // An extra charge shares its month with the regular fee, so the
              // row says what it is rather than repeating the month twice.
              c.kind === "EXTRA" && c.label ? `${c.label} · ${label}` : label,
              money(c.amount),
              money(c.paidAmount),
              money(Math.max(0, c.amount - c.paidAmount)),
              statusLabel(c.status),
            ];
          })}
        />
      )}
      <h3 className="text-sm font-semibold">{t("parents.paymentHistoryAllChildren")}</h3>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("parents.noPaymentsRecorded")}
        </p>
      ) : (
        <DataTable
          headers={["Receipt", "Student", "Amount", "Type", "Date"]}
          rows={payments.map((p) => [
            p.receiptNumber,
            p.childName,
            money(p.amount),
            statusLabel(p.type),
            shortDate(p.paidAt),
          ])}
        />
      )}
    </div>
  );
}

/**
 * The exams this child actually sat.
 *
 * This used to be three fixed exam names with averages generated from the
 * student's code — the same invention as the fee ledger, in a place a parent
 * is likely to believe it. It now reads the published results, and says so
 * plainly when there are none.
 */
function ExamsTab({ child }: { child: Student }) {
  const t = useT();
  const [result, setResult] = useState<ApiStudentFinalResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiStudentResults(child.id)
      .then((r) => alive && setResult(r))
      .catch(() => alive && setResult(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [child.id]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("parents.loadingProfile")}</p>
    );
  }

  const terms = result?.termResults ?? [];
  if (terms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("parents.noExamResultsYet")}</p>
    );
  }

  return (
    <DataTable
      headers={["Exam", "Term", "Total", "Average", "Grade", "Result"]}
      rows={terms.map((r) => [
        r.examName,
        r.term,
        r.totalMax,
        r.average,
        r.grade,
        r.passed ? "Pass" : "Fail",
      ])}
    />
  );
}

function QuizzesTab({ child }: { child: Student }) {
  const rows = useMemo(() => quizHistory(child), [child]);
  return (
    <DataTable
      headers={["Quiz", "Score", "Percentage", "Status", "Date"]}
      rows={rows.map((r) => [
        r.name,
        `${r.score}/${r.total}`,
        `${r.percentage}%`,
        statusLabel(r.status),
        shortDate(r.date),
      ])}
    />
  );
}

function ProgressTab({ child }: { child: Student }) {
  const t = useT();
  // The recorded promotions, not a ladder walked backwards from the class
  // this child happens to be in today.
  const promos = useMemo(() => studentPromotionHistory(child.id), [child.id]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label={t("parents.currentClass")}
          value={`${child.className}${child.section ? ` - ${child.section}` : ""}`}
        />
        <Field label={t("parents.gender")} value={genderLabel(child.gender)} />
        <Field label={t("parents.status")} value={statusLabel(child.status)} />
      </div>
      <h3 className="text-sm font-semibold">{t("parents.promotionHistory")}</h3>
      {promos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("parents.noPromotionHistoryYet")}
        </p>
      ) : (
        <DataTable
          headers={["Academic Year", "From", "To", "Date"]}
          rows={promos.map((p) => [
            p.fromAcademicYear,
            p.fromClass,
            p.graduated ? "Graduated" : p.toClass,
            shortDate(p.promotedAt),
          ])}
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

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-start text-xs text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
