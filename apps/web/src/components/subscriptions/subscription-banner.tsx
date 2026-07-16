"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SchoolSubscriptionMe } from "@/lib/subscriptions/types";

/**
 * Green / orange / red subscription status strip for the school admin app.
 * Loaded from GET /subscriptions/me.
 */
export function SubscriptionBanner() {
  const [data, setData] = useState<SchoolSubscriptionMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<SchoolSubscriptionMe>("/subscriptions/me")
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        /* roles without access simply hide the banner */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.banner) return null;

  const styles = {
    green:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    orange:
      "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    red: "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100",
  } as const;

  const Icon =
    data.banner.tone === "green"
      ? CheckCircle2
      : data.banner.tone === "orange"
        ? AlertTriangle
        : XCircle;

  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        styles[data.banner.tone],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{data.banner.message}</p>
        {data.plan && (
          <p className="mt-0.5 text-xs opacity-80">
            Plan: {data.plan.name}
            {data.endDate
              ? ` · Ends ${data.endDate.slice(0, 10)}`
              : ""}
            {data.daysRemaining != null && data.daysRemaining >= 0
              ? ` · ${data.daysRemaining} day(s) left`
              : ""}
          </p>
        )}
        <Link
          href="/settings/subscription"
          className="mt-1 inline-block text-xs font-medium underline-offset-2 hover:underline"
        >
          View subscription details
        </Link>
      </div>
    </div>
  );
}
