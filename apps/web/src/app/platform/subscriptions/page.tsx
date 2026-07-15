"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, RefreshCw, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { PlanFormDialog, type PlanFormValues } from "@/components/platform/plan-form-dialog";
import { AssignSubscriptionDialog } from "@/components/platform/assign-subscription-dialog";
import { shortDate } from "@/lib/platform/format";
import { toast } from "@/lib/toast";
import {
  assignPlatformSchoolSubscription,
  cancelPlatformSchoolSubscription,
  createPlatformSubscriptionPlan,
  deletePlatformSubscriptionPlan,
  fetchPlatformSchoolSubscriptions,
  fetchPlatformSubscriptionPlans,
  updatePlatformSubscriptionPlan,
  type PlatformSchoolSubscriptionRow,
  type PlatformSubscriptionPlan,
} from "@/lib/platform/api";

const TABS = [
  { id: "plans", label: "Plans" },
  { id: "schools", label: "Schools" },
];

function StatusBadge({ status }: { status: "ACTIVE" | "EXPIRED" | "CANCELLED" }) {
  const styles =
    status === "ACTIVE"
      ? "bg-emerald-500/10 text-emerald-400"
      : status === "EXPIRED"
        ? "bg-amber-500/10 text-amber-400"
        : "bg-slate-500/10 text-slate-400";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}

export default function PlatformSubscriptionsPage() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("plans");
  const [plans, setPlans] = useState<PlatformSubscriptionPlan[]>([]);
  const [rows, setRows] = useState<PlatformSchoolSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlatformSubscriptionPlan | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRow, setAssignRow] = useState<PlatformSchoolSubscriptionRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        fetchPlatformSubscriptionPlans(),
        fetchPlatformSchoolSubscriptions(),
      ]);
      setPlans(p);
      setRows(r);
    } catch {
      /* keep previous state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted) void reload();
  }, [mounted, reload]);

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
  }

  async function handleCancel(row: PlatformSchoolSubscriptionRow) {
    if (!confirm(`Cancel ${row.school.name}'s subscription?`)) return;
    try {
      await cancelPlatformSchoolSubscription(row.school.id);
      toast("Subscription cancelled", "success");
      await reload();
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
            Billing plans and per-school assignment — student caps, subscription
            length, and monthly AI grading quota.
          </p>
        </div>
        {tab === "plans" && (
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
      </div>

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={setTab}
        className="border-white/10 text-slate-400"
      />

      {tab === "plans" ? (
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
      ) : (
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
                    <p className="font-medium text-white">{row.school.name}</p>
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
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAssignRow(row);
                          setAssignOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                        title={row.subscription ? "Renew / change plan" : "Assign plan"}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      {row.subscription && row.subscription.status !== "CANCELLED" && (
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
