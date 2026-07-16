"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Loader2,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/students/format";
import { useIsSchoolSuperAdmin } from "@/lib/users/super-admin";
import type { SchoolSubscriptionMe } from "@/lib/subscriptions/types";

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
  const [data, setData] = useState<SchoolSubscriptionMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) router.replace("/settings");
  }, [isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    void api<SchoolSubscriptionMe>("/subscriptions/me")
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load subscription");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Layers className="h-6 w-6 text-primary" />
          Subscription
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan, expiry, and usage for this school. Contact Platform Support to
          renew or change plans.
        </p>
      </div>

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
                {data.assignedByUsername ?? "—"}
              </dd>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <dt className="text-xs text-muted-foreground">Assigned on</dt>
              <dd className="mt-1 font-medium">
                {shortDate(data.assignedAt)}
              </dd>
            </div>
          </dl>

          <div>
            <h2 className="mb-3 text-sm font-semibold">Usage</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <UsageBar
                label="Students"
                used={data.studentCount}
                limit={data.studentLimit}
                remaining={data.studentsRemaining}
              />
              <UsageBar
                label="AI grading (this month)"
                used={data.aiGradingUsed}
                limit={data.aiLimit}
                remaining={data.aiRemaining}
              />
            </div>
          </div>

          {data.plan && (
            <div className="rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Plan limits</h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Max students</dt>
                  <dd className="mt-0.5 font-medium">
                    {data.plan.maxStudents ?? "Unlimited"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    AI grading / month
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {data.plan.aiGradingMonthlyQuota ?? "Unlimited"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Duration</dt>
                  <dd className="mt-0.5 font-medium">
                    {data.plan.durationDays} days
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </>
      )}
    </div>
  );
}
