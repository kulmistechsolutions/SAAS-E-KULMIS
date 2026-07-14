"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { monthLabel, nextMonthKey } from "@/lib/fees/format";
import { apiFeeSettings } from "@/lib/fees/api";
import {
  activateNextMonth,
  canActivateNextMonth,
  getFeeMonthSetupDay,
  useFeesState,
} from "@/lib/fees/store";
import { toast } from "@/lib/toast";

export default function MonthlySetupPage() {
  const fees = useFeesState();
  const nextKey = nextMonthKey(fees.activeMonthKey);
  const canActivate = canActivateNextMonth();
  const setupDay = getFeeMonthSetupDay();
  const [billingMode, setBillingMode] = useState<"MONTHLY" | "ACADEMIC_YEAR" | null>(
    null,
  );

  useEffect(() => {
    void apiFeeSettings()
      .then((s) => setBillingMode(s.billingMode))
      .catch(() => setBillingMode("MONTHLY"));
  }, []);

  async function handleSetup() {
    const res = await activateNextMonth();
    if (!res.ok) toast(res.error ?? "Failed", "error");
    else toast(`Activated ${monthLabel(nextKey)}`, "success");
  }

  if (billingMode === "ACADEMIC_YEAR") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Monthly Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Not used when Academic Year billing is active.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Academic Year Billing is enabled</p>
              <p className="mt-1 text-sm">
                The school charges the full annual tuition upfront and tracks month-by-month
                progress. Use Academic Year Setup instead of monthly activation.
              </p>
              <Link href="/finance/academic-year-setup">
                <Button className="mt-4" variant="outline">
                  Go to Academic Year Setup
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monthly Setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activate billing months. Only one month can be active at a time.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">Current Active Month</p>
            <p className="text-xl font-bold text-emerald-600">
              {monthLabel(fees.activeMonthKey)}
            </p>
          </div>
          <Badge tone="success" className="ml-auto" dot>
            Active
          </Badge>
        </div>

        <dl className="mt-6 grid gap-3 text-sm">
          <div className="flex justify-between rounded-lg bg-secondary/40 px-4 py-3">
            <dt className="text-muted-foreground">Academic Year</dt>
            <dd className="font-medium">{fees.academicYear}</dd>
          </div>
          <div className="flex justify-between rounded-lg bg-secondary/40 px-4 py-3">
            <dt className="text-muted-foreground">Activated Billing Periods</dt>
            <dd className="font-medium">{fees.billingPeriods.length}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-dashed bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Calendar className="h-4 w-4 text-primary" />
          Activate Next Month
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          A new month can only be activated after the {setupDay}th of the current billing
          month. When activated, the system creates fee records for all active students,
          carries forward unpaid balances, and skips months covered by advance payments.
        </p>
        <div className="mt-4 rounded-xl bg-secondary/30 p-4">
          <p className="text-xs text-muted-foreground">Next Month</p>
          <p className="text-lg font-semibold">{monthLabel(nextKey)}</p>
        </div>
        <Button className="mt-4 w-full" disabled={!canActivate} onClick={handleSetup}>
          Setup Next Month — {monthLabel(nextKey)}
        </Button>
        {!canActivate && (
          <p className="mt-2 text-center text-xs text-amber-600">
            Available after the {setupDay}th of {monthLabel(fees.activeMonthKey)}
          </p>
        )}
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <p className="border-b px-5 py-3 text-sm font-semibold">Billing History</p>
        <ul className="divide-y">
          {[...fees.billingPeriods].reverse().map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between px-5 py-3 text-sm"
            >
              <span>{monthLabel(b.monthKey)}</span>
              <Badge tone={b.status === "ACTIVE" ? "success" : "muted"}>
                {b.status}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
