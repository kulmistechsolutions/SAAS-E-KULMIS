"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Layers,
  Loader2,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/students/format";
import { useIsSchoolSuperAdmin } from "@/lib/users/super-admin";
import { toast } from "@/lib/toast";
import type { SchoolSubscriptionMe } from "@/lib/subscriptions/types";
import {
  apiPurchaseSubscriptionPlan,
  apiSubscriptionPaymentOrders,
  apiSubscriptionPaymentReceipt,
  apiSubscriptionPlans,
  apiVerifySubscriptionPayment,
  type AvailableSubscriptionPlan,
  type SubscriptionPaymentOrderRow,
  type SubscriptionPaymentReceipt,
} from "@/lib/subscriptions/api";

function money(n: string | number | null, currency = "USD") {
  if (n == null) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  return `${currency} ${Number.isFinite(v) ? v.toFixed(2) : n}`;
}

const STATUS_CLASS: Record<string, string> = {
  SUCCESS: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  FAILED: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  EXPIRED: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  PROCESSING: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

function UsageBar({
  label,
  used,
  limit,
  remaining,
}: {
  label: string;
  used: number;
  limit: number | null;
  remaining: number | null;
}) {
  const pct =
    limit == null || limit <= 0
      ? null
      : Math.min(100, Math.round((used / limit) * 100));
  const unlimited = limit == null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {unlimited
            ? `${used.toLocaleString()} used · Unlimited`
            : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct == null
              ? "w-1/12 bg-emerald-500/60"
              : pct >= 90
                ? "bg-rose-500"
                : pct >= 70
                  ? "bg-amber-500"
                  : "bg-emerald-500",
          )}
          style={{ width: pct == null ? "8%" : `${pct}%` }}
        />
      </div>
      {!unlimited && remaining != null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {remaining.toLocaleString()} remaining this period
        </p>
      )}
    </div>
  );
}

export default function SubscriptionSettingsPage() {
  const router = useRouter();
  const isAdmin = useIsSchoolSuperAdmin();
  const [tab, setTab] = useState<"current" | "plans" | "history" | "receipt">(
    "current",
  );

  const [data, setData] = useState<SchoolSubscriptionMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [plans, setPlans] = useState<AvailableSubscriptionPlan[]>([]);
  const [orders, setOrders] = useState<SubscriptionPaymentOrderRow[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [payerAccount, setPayerAccount] = useState("");
  const [channel, setChannel] = useState<"API_PURCHASE" | "HPP_PURCHASE">(
    "API_PURCHASE",
  );
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<SubscriptionPaymentReceipt | null>(
    null,
  );

  useEffect(() => {
    if (!isAdmin) router.replace("/settings");
  }, [isAdmin, router]);

  const loadCurrent = useCallback(() => {
    setLoading(true);
    return api<SchoolSubscriptionMe>("/subscriptions/me")
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load subscription");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([
        apiSubscriptionPlans(),
        apiSubscriptionPaymentOrders().catch(() => []),
      ]);
      setPlans(p);
      setOrders(o);
      setSelectedPlan((prev) => prev || p[0]?.id || "");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load plans", "error");
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void loadCurrent();
    void loadPlans();
  }, [isAdmin, loadCurrent, loadPlans]);

  async function buy() {
    if (!selectedPlan) return toast("Select a plan", "error");
    if (channel === "API_PURCHASE" && !payerAccount.trim()) {
      return toast("Enter the mobile wallet number to pay from", "error");
    }
    setPaying(true);
    try {
      const res = await apiPurchaseSubscriptionPlan({
        planId: selectedPlan,
        payerAccount: payerAccount.trim() || undefined,
        channel,
      });
      setReceipt(res);
      if (res.status === "SUCCESS") {
        toast(`Subscription activated — plan "${res.plan.name}"`, "success");
      } else if (res.hppUrl) {
        toast("Redirecting to WaafiPay…", "info");
        window.open(res.hppUrl, "_blank", "noopener,noreferrer");
      } else {
        toast(`Payment status: ${res.status}`, "info");
      }
      setTab("receipt");
      await Promise.all([loadCurrent(), loadPlans()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Payment failed", "error");
    } finally {
      setPaying(false);
    }
  }

  async function openReceipt(id: string) {
    try {
      const r = await apiSubscriptionPaymentReceipt(id);
      setReceipt(r);
      setTab("receipt");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load receipt", "error");
    }
  }

  async function verify(id: string) {
    try {
      const r = await apiVerifySubscriptionPayment(id);
      setReceipt(r);
      if (r.status === "SUCCESS") {
        toast("Payment verified — subscription activated", "success");
        await loadCurrent();
      } else {
        toast(`Status: ${r.status}`, "info");
      }
      await loadPlans();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Verification failed", "error");
    }
  }

  if (!isAdmin) return null;

  const toneStyles = {
    green:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    orange:
      "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    red: "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100",
  } as const;

  const ToneIcon =
    data?.banner.tone === "green"
      ? CheckCircle2
      : data?.banner.tone === "orange"
        ? AlertTriangle
        : XCircle;

  const TABS = [
    ["current", "Current"],
    ["plans", "Plans"],
    ["history", "Payment history"],
    ["receipt", "Receipt"],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Layers className="h-6 w-6 text-primary" />
          Subscription
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Current plan, usage, and upgrade options for this school.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              tab === id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "current" && (
        <>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subscription…
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          {!loading && data && (
            <>
              <div
                role="status"
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
                  toneStyles[data.banner.tone],
                )}
              >
                <ToneIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{data.banner.message}</p>
                  <p className="mt-0.5 text-xs opacity-80">
                    Status: {data.status}
                    {data.daysRemaining != null && data.daysRemaining >= 0
                      ? ` · ${data.daysRemaining} day(s) left`
                      : ""}
                  </p>
                </div>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-card p-4">
                  <dt className="text-xs text-muted-foreground">Plan</dt>
                  <dd className="mt-1 font-medium">
                    {data.plan?.name ?? "No plan assigned"}
                  </dd>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <dt className="text-xs text-muted-foreground">Period</dt>
                  <dd className="mt-1 font-medium">
                    {data.startDate || data.endDate
                      ? `${shortDate(data.startDate)} → ${shortDate(data.endDate)}`
                      : "—"}
                  </dd>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <dt className="text-xs text-muted-foreground">Assigned by</dt>
                  <dd className="mt-1 font-medium">
                    {data.assignedByUsername ?? "Self-purchased"}
                  </dd>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <dt className="text-xs text-muted-foreground">Assigned on</dt>
                  <dd className="mt-1 font-medium">{shortDate(data.assignedAt)}</dd>
                </div>
              </dl>

              <div>
                <h2 className="mb-3 text-sm font-semibold">Usage</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <UsageBar
                    label="Students"
                    used={data.studentCount}
                    limit={data.studentLimit}
                    remaining={data.studentsRemaining}
                  />
                  <UsageBar
                    label="Teachers"
                    used={data.teacherCount}
                    limit={data.teacherLimit}
                    remaining={data.teachersRemaining}
                  />
                  <UsageBar
                    label="AI grading (this month)"
                    used={data.aiGradingUsed}
                    limit={data.aiLimit}
                    remaining={data.aiRemaining}
                  />
                </div>
              </div>

              {(!data.plan || data.status !== "ACTIVE") && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="font-medium">
                    {data.plan
                      ? "Renew your subscription to keep using premium features."
                      : "No plan assigned yet — pick one to unlock student/teacher limits and AI grading."}
                  </p>
                  <Button className="mt-3" onClick={() => setTab("plans")}>
                    View available plans
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === "plans" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {plans.length === 0 ? (
              <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                No plans published yet. Contact your platform administrator.
              </div>
            ) : (
              plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlan(p.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left shadow-sm transition",
                    selectedPlan === p.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "bg-card hover:border-primary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {p.maxStudents ?? "Unlimited"} students ·{" "}
                        {p.maxTeachers ?? "Unlimited"} teachers ·{" "}
                        {p.aiGradingMonthlyQuota ?? "Unlimited"} AI grades/mo
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.durationDays} days
                      </p>
                    </div>
                    <p className="text-lg font-bold text-primary">
                      {money(p.priceUsd)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <CreditCard className="h-4 w-4" /> Pay with WaafiPay
            </h2>
            <div>
              <Label>Payment channel</Label>
              <Select
                className="mt-1.5"
                value={channel}
                onChange={(e) =>
                  setChannel(e.target.value as "API_PURCHASE" | "HPP_PURCHASE")
                }
              >
                <option value="API_PURCHASE">
                  Direct mobile wallet (EVC / ZAAD / SAHAL)
                </option>
                <option value="HPP_PURCHASE">Hosted Payment Page</option>
              </Select>
            </div>
            <div>
              <Label>Payer mobile number</Label>
              <Input
                className="mt-1.5"
                value={payerAccount}
                onChange={(e) => setPayerAccount(e.target.value)}
                placeholder="252611111111"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                International format, no +. Required for direct wallet payment.
              </p>
            </div>
            <Button
              className="w-full"
              disabled={!selectedPlan || paying}
              onClick={() => void buy()}
            >
              {paying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Pay &amp; activate plan
            </Button>
            <p className="text-xs text-muted-foreground">
              After Waafi confirms payment, your plan activates automatically —
              no manual approval needed.
            </p>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No purchases yet.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{o.plan.name}</td>
                    <td className="px-4 py-3">{money(o.amount, o.currency)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_CLASS[o.status] ?? STATUS_CLASS.PENDING,
                        )}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {o.receiptNumber ?? o.referenceId}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(o.paidAt ?? o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => void openReceipt(o.id)}
                      >
                        View
                      </Button>
                      {(o.status === "PENDING" || o.status === "PROCESSING") && (
                        <Button
                          className="ml-2 h-8 px-3 text-xs"
                          onClick={() => void verify(o.id)}
                        >
                          Verify
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "receipt" &&
        (receipt ? (
          <div className="mx-auto max-w-lg space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Payment receipt</h2>
              {receipt.status === "SUCCESS" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{receipt.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Receipt #</dt>
                <dd className="font-mono text-xs">{receipt.receiptNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium">{receipt.plan.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium">{money(receipt.amount, receipt.currency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Waafi Txn</dt>
                <dd className="font-mono text-xs">
                  {receipt.waafiTransactionId ?? "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="font-mono text-xs">{receipt.referenceId}</dd>
              </div>
            </dl>
            {receipt.hppUrl && receipt.status !== "SUCCESS" ? (
              <a
                href={receipt.hppUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <ExternalLink className="h-4 w-4" /> Continue on WaafiPay
              </a>
            ) : null}
            {(receipt.status === "PENDING" || receipt.status === "PROCESSING") && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => void verify(receipt.id)}
              >
                Verify payment with Waafi
              </Button>
            )}
            {receipt.failureReason ? (
              <p className="text-sm text-rose-600">{receipt.failureReason}</p>
            ) : null}
            {receipt.auditLogs.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Audit trail</h3>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {receipt.auditLogs.map((a) => (
                    <li key={a.id}>
                      {new Date(a.createdAt).toLocaleString()} — {a.action}: {a.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            Select a purchase from payment history to view its receipt.
          </p>
        ))}
    </div>
  );
}
