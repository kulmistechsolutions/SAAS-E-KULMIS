"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SchoolSubscriptionMe } from "@/lib/subscriptions/types";

/**
 * Orange / red subscription warning strip for the school admin app. Only
 * shown when the subscription needs attention (expiring soon, expired, or
 * unassigned) — a healthy subscription with plenty of time left stays
 * silent so it doesn't take up space on every page.
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

  if (!data?.banner || data.banner.tone === "green") return null;

  const styles = {
    orange:
      "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    red: "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100",
  } as const;

  const Icon = data.banner.tone === "orange" ? AlertTriangle : XCircle;

  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-3 py-1.5 text-xs",
        styles[data.banner.tone],
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <p className="font-medium">{data.banner.message}</p>
      {data.daysRemaining != null && data.daysRemaining >= 0 && (
        <span className="opacity-80">· {data.daysRemaining} day(s) left</span>
      )}
      <Link
        href="/settings/subscription"
        className="font-medium underline-offset-2 hover:underline"
      >
        View details
      </Link>
    </div>
  );
}
