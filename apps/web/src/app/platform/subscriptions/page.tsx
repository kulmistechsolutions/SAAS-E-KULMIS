"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Ban,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Users,
  Download,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { PlanFormDialog, type PlanFormValues } from "@/components/platform/plan-form-dialog";
import { AssignSubscriptionDialog } from "@/components/platform/assign-subscription-dialog";
import { shortDate } from "@/lib/platform/format";
import { toast } from "@/lib/toast";
import { usePlatformAuth } from "@/lib/platform/auth";
import {
  assignPlatformSchoolSubscription,
  cancelPlatformSchoolSubscription,
  createPlatformSubscriptionPlan,
  deletePlatformSubscriptionPlan,
  fetchPlatformSchoolSubscriptions,
  fetchPlatformSubscriptionDashboard,
  fetchPlatformSubscriptionHistory,
  fetchPlatformSubscriptionPlans,
  updatePlatformSubscriptionPlan,
  type PlatformSchoolSubscriptionRow,
  type PlatformSubscriptionDashboard,
  type PlatformSubscriptionHistoryRow,
  type PlatformSubscriptionPlan,
} from "@/lib/platform/api";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "plans", label: "Plans" },
  { id: "schools", label: "Schools" },
  { id: "history", label: "History" },
];

function StatusBadge({ status }: { status: "ACTIVE" | "EXPIRED" | "CANCELLED" }) {
  const styles =
    status === "ACTIVE"
      ? "bg-emerald-500/10 text-emerald-400"
      : status === "EXPIRED"
        ? "bg-rose-500/10 text-rose-400"
        : "bg-slate-500/10 text-slate-400";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Building2;
  tone: "violet" | "emerald" | "rose" | "amber" | "sky" | "indigo";
}) {
  const tones = {
    violet: "from-violet-500/20 to-violet-500/5 text-violet-300",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-300",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-300",
    sky: "from-sky-500/20 to-sky-500/5 text-sky-300",
    indigo: "from-indigo-500/20 to-indigo-500/5 text-indigo-300",
  };
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-gradient-to-br p-5 shadow-sm ${tones[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <span className="rounded-xl bg-white/5 p-2.5">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function exportHistoryCsv(rows: PlatformSubscriptionHistoryRow[]) {
  const header = [
    "School",
    "Subdomain",
    "Plan",
    "Assigned By",
    "Assigned Date",
    "Expired Date",
    "Status",
    "Action",
  ];
  const lines = rows.map((r) =>
    [
      r.school.name,
      r.school.subdomain,
      r.plan,
      r.assignedBy,
      r.assignedDate.slice(0, 10),
      r.expiredDate.slice(0, 10),
      r.status,
      r.action,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `subscription-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PlatformSubscriptionsPage() {
  const { admin } = usePlatformAuth();
  const canMutate = admin?.role !== "OPERATOR";
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("overview");
  const [plans, setPlans] = useState<PlatformSubscriptionPlan[]>([]);
  const [rows, setRows] = useState<PlatformSchoolSubscriptionRow[]>([]);
  const [dashboard, setDashboard] = useState<PlatformSubscriptionDashboard | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const [historyRows, setHistoryRows] = useState<PlatformSubscriptionHistoryRow[]>(
    [],
  );
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageCount, setHistoryPageCount] = useState(1);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlatformSubscriptionPlan | null>(
    null,
  );
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRow, setAssignRow] = useState<PlatformSchoolSubscriptionRow | null>(
    null,
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, d] = await Promise.all([
        fetchPlatformSubscriptionPlans(),
        fetchPlatformSchoolSubscriptions(),
        fetchPlatformSubscriptionDashboard(),
      ]);
      setPlans(p);
      setRows(r);
      setDashboard(d);
    } catch {
      /* keep previous state */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetchPlatformSubscriptionHistory({
        search: historySearch || undefined,
        status: historyStatus || undefined,
        page: historyPage,
        pageSize: 20,
      });
      setHistoryRows(res.rows);
      setHistoryTotal(res.total);
      setHistoryPageCount(res.pageCount);
    } catch {
      toast("Failed to load subscription history", "error");
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historyStatus, historyPage]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted) void reload();
  }, [mounted, reload]);
  useEffect(() => {
    if (mounted && tab === "history") void loadHistory();
  }, [mounted, tab, loadHistory]);

  const statusBreakdown = useMemo(() => {
    if (!dashboard) return [];
    return Object.entries(dashboard.subscriptionStatus).map(([k, v]) => ({
      label: k,
      value: v,
    }));
  }, [dashboard]);

  async function handleCreateOrUpdatePlan(values: PlanFormValues) {
    if (editingPlan) {
      await updatePlatformSubscriptionPlan(editingPlan.id, values);
      toast(`Plan "${values.name}" updated`, "success");
    } else {
      await createPlatformSubscriptionPlan(values);
      toast(`Plan "${values.name}" created`, "success");
    }
    await reload();
  }

  async function handleDeletePlan(plan: PlatformSubscriptionPlan) {
    if (!confirm(`Delete plan "${plan.name}"? This can't be undone.`)) return;
    try {
      await deletePlatformSubscriptionPlan(plan.id);
      toast("Plan deleted", "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete plan", "error");
    }
  }

  async function handleAssign(planId: string) {
    if (!assignRow) return;
    await assignPlatformSchoolSubscription(assignRow.school.id, { planId });
    toast(`Plan assigned to ${assignRow.school.name}`, "success");
    await reload();
    if (tab === "history") void loadHistory();
  }

  async function handleCancel(row: PlatformSchoolSubscriptionRow) {
    if (!confirm(`Cancel ${row.school.name}'s subscription?`)) return;
    try {
      await cancelPlatformSchoolSubscription(row.school.id);
      toast("Subscription cancelled", "success");
      await reload();
      if (tab === "history") void loadHistory();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to cancel", "error");
    }
  }

  if (!mounted) return <div className="text-slate-400">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="mt-1 text-sm text-slate-400">
            Plans, school assignments, usage limits, and subscription history.
          </p>
        </div>
        {tab === "plans" && canMutate && (
          <Button
            className="bg-violet-600 hover:bg-violet-500"
            onClick={() => {
              setEditingPlan(null);
              setPlanDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Plan
          </Button>
        )}
        {!canMutate && (
          <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
            Read-only · Operator role
          </p>
        )}
      </div>

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={setTab}
        className="border-white/10 text-slate-400"
      />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Total Schools"
              value={dashboard?.totalSchools ?? "—"}
              icon={Building2}
              tone="violet"
            />
            <KpiCard
              label="Active Schools"
              value={dashboard?.activeSchools ?? "—"}
              hint={
                dashboard
                  ? `${dashboard.expiringSoon} expiring within 7 days`
                  : undefined
              }
              icon={CheckCircle2}
              tone="emerald"
            />
            <KpiCard
              label="Expired Schools"
              value={dashboard?.expiredSchools ?? "—"}
              hint={
                dashboard
                  ? `${dashboard.unassignedSchools} unassigned`
                  : undefined
              }
              icon={AlertTriangle}
              tone="rose"
            />
            <KpiCard
              label="Total AI Usage"
              value={
                dashboard
                  ? dashboard.totalAiQuota != null
                    ? `${dashboard.totalAiUsage} / ${dashboard.totalAiQuota}`
                    : dashboard.totalAiUsage
                  : "—"
              }
              hint="Current billing month across schools"
              icon={Sparkles}
              tone="sky"
            />
            <KpiCard
              label="Student Usage"
              value={
                dashboard
                  ? dashboard.studentCap != null
                    ? `${dashboard.studentUsage} / ${dashboard.studentCap}`
                    : dashboard.studentUsage
                  : "—"
              }
              hint="Students enrolled vs plan caps"
              icon={Users}
              tone="indigo"
            />
            <KpiCard
              label="Subscription Status"
              value={
                dashboard
                  ? `${dashboard.subscriptionStatus.ACTIVE} active`
                  : "—"
              }
              hint={
                dashboard
                  ? `${dashboard.subscriptionStatus.EXPIRED} expired · ${dashboard.subscriptionStatus.CANCELLED} cancelled`
                  : undefined
              }
              icon={RefreshCw}
              tone="amber"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold text-white">Status breakdown</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {statusBreakdown.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/5 bg-black/20 px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {s.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "plans" && (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-400">
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Max Students</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">AI Grading / mo</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {p.maxStudents ?? "Unlimited"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{p.durationDays} days</td>
                  <td className="px-4 py-3 text-slate-300">
                    {p.aiGradingMonthlyQuota ?? "Unlimited"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {p.priceUsd != null ? `$${p.priceUsd}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.isActive
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-slate-500/10 text-slate-400"
                      }`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canMutate ? (
                      <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPlan(p);
                          setPlanDialogOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeletePlan(p)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {plans.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No plans yet — create your first plan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "schools" && (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-400">
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">AI Grading</th>
                <th className="px-4 py-3">Ends</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.school.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Link
                      href={`/platform/schools/${row.school.id}`}
                      className="font-medium text-white hover:text-violet-300 hover:underline"
                    >
                      {row.school.name}
                    </Link>
                    <p className="font-mono text-xs text-slate-500">
                      {row.school.subdomain}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.subscription?.plan.name ?? "— unassigned —"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.studentCount}
                    {row.subscription?.plan.maxStudents != null
                      ? ` / ${row.subscription.plan.maxStudents}`
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.subscription
                      ? `${row.subscription.aiGradingUsed}${
                          row.subscription.plan.aiGradingMonthlyQuota != null
                            ? ` / ${row.subscription.plan.aiGradingMonthlyQuota}`
                            : ""
                        }`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {row.subscription ? shortDate(row.subscription.endDate) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.subscription ? (
                      <StatusBadge status={row.subscription.status} />
                    ) : (
                      <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                        No plan
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canMutate ? (
                      <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAssignRow(row);
                          setAssignOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                        title={
                          row.subscription ? "Renew / change plan" : "Assign plan"
                        }
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      {row.subscription &&
                        row.subscription.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => void handleCancel(row)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                            title="Cancel subscription"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                    </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No schools yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                placeholder="Search school, plan, admin…"
                value={historySearch}
                onChange={(e) => {
                  setHistoryPage(1);
                  setHistorySearch(e.target.value);
                }}
              />
            </div>
            <Select
              className="w-40 border-white/10 bg-white/5 text-white"
              value={historyStatus}
              onChange={(e) => {
                setHistoryPage(1);
                setHistoryStatus(e.target.value);
              }}
            >
              <option value="">All status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CANCELLED">CANCELLED</option>
            </Select>
            <Button
              variant="outline"
              className="border-white/10 text-slate-200"
              onClick={() => exportHistoryCsv(historyRows)}
              disabled={historyRows.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Assigned By</th>
                  <th className="px-4 py-3">Assigned Date</th>
                  <th className="px-4 py-3">Expired Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link
                        href={`/platform/schools/${r.school.id}`}
                        className="font-medium text-white hover:underline"
                      >
                        {r.school.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.plan}</td>
                    <td className="px-4 py-3 text-slate-300">{r.assignedBy}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {shortDate(r.assignedDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {shortDate(r.expiredDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
                {historyRows.length === 0 && !historyLoading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No history records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={historyPage}
            pageCount={historyPageCount}
            total={historyTotal}
            pageSize={20}
            onPageChange={setHistoryPage}
          />
        </div>
      )}

      <PlanFormDialog
        open={planDialogOpen}
        onClose={() => setPlanDialogOpen(false)}
        plan={editingPlan}
        onSubmit={handleCreateOrUpdatePlan}
      />
      <AssignSubscriptionDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        row={assignRow}
        plans={plans.filter((p) => p.isActive)}
        onSubmit={handleAssign}
      />
    </div>
  );
}
