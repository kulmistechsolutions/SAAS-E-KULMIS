"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { monthLabel, nextMonthKey } from "@/lib/fees/format";
import { apiFeeSettings } from "@/lib/fees/api";
import {
  activateNextMonth,
  canActivateNextMonth,
  getFeeMonthSetupDay,
  pendingMonthClasses,
  useFeesState,
  type MonthSetupClassGroup,
} from "@/lib/fees/store";
import { MonthBillingSetup } from "@/components/fees/month-billing-setup";
import { toast } from "@/lib/toast";

export default function MonthlySetupPage() {
  const fees = useFeesState();
  const nextKey = nextMonthKey(fees.activeMonthKey);
  const canActivate = canActivateNextMonth();
  const setupDay = getFeeMonthSetupDay();
  const [billingMode, setBillingMode] = useState<
    "MONTHLY" | "ACADEMIC_YEAR" | null
  >(null);
  const [saving, setSaving] = useState(false);
  // Every class starts ticked (charged). Unticking one — e.g. it's on break
  // this month — leaves it out of this run without touching anything else.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useEffect(() => {
    void apiFeeSettings()
      .then((s) => setBillingMode(s.billingMode))
      .catch(() => setBillingMode("MONTHLY"));
  }, []);

  const classGroups = useMemo<MonthSetupClassGroup[]>(
    () => pendingMonthClasses(),
    // Recomputed each time the fees store refreshes (new active month, etc).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fees],
  );
  const includedCount = classGroups.length - excluded.size;
  // A fresh school has no billing periods until it sets a month up — don't
  // claim a month is "Active" when nothing has been activated.
  const hasBilling = fees.billingPeriods.length > 0;

  function toggleClass(key: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSetup() {
    setSaving(true);
    try {
      const res = await activateNextMonth(undefined, [...excluded]);
      if (!res.ok) {
        toast(res.error ?? "Failed", "error");
        return;
      }
      toast(
        excluded.size > 0
          ? `Activated ${monthLabel(nextKey)} for ${includedCount} class(es) — ${excluded.size} excluded.`
          : `Activated ${monthLabel(nextKey)}`,
        "success",
      );
      setExcluded(new Set());
    } finally {
      setSaving(false);
    }
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
                The school charges the full annual tuition upfront and tracks
                month-by-month progress. Use Academic Year Setup instead of
                monthly activation.
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
          Turn billing on for the month. Nothing is charged, and no payment can
          be collected, until you set it up here.
        </p>
      </div>

      <MonthBillingSetup />

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              hasBilling
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">
              Current Active Month
            </p>
            <p
              className={`text-xl font-bold ${
                hasBilling ? "text-emerald-600" : "text-muted-foreground"
              }`}
            >
              {hasBilling ? monthLabel(fees.activeMonthKey) : "Not set up yet"}
            </p>
          </div>
          <Badge
            tone={hasBilling ? "success" : "muted"}
            className="ml-auto"
            dot
          >
            {hasBilling ? "Active" : "Inactive"}
          </Badge>
        </div>

        {!hasBilling && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            No month is active yet. Use{" "}
            <span className="font-medium">
              Set up this month&apos;s billing
            </span>{" "}
            above to turn billing on — nothing is charged and no payment can be
            collected until you do.
          </p>
        )}

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
          A new month can only be activated after the {setupDay}th of the
          current billing month. When activated, the system creates fee records
          for every ticked class, carries forward unpaid balances, and skips
          months covered by advance payments.
        </p>
        <div className="mt-4 rounded-xl bg-secondary/30 p-4">
          <p className="text-xs text-muted-foreground">Next Month</p>
          <p className="text-lg font-semibold">{monthLabel(nextKey)}</p>
        </div>

        {classGroups.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Classes to charge this month
              </p>
              <p className="text-xs text-muted-foreground">
                {includedCount} of {classGroups.length} selected
              </p>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Untick a class that&apos;s on break this month — it will be
              skipped and picks back up normally once ticked again next time.
            </p>
            <div className="max-h-64 overflow-y-auto rounded-xl border">
              {classGroups.map((g) => {
                const checked = !excluded.has(g.key);
                return (
                  <label
                    key={g.key}
                    className="flex cursor-pointer items-center justify-between gap-2 border-b px-3 py-2 text-sm last:border-0 hover:bg-secondary/40"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleClass(g.key)}
                      />
                      <span>
                        {g.className}
                        {g.sectionName ? ` — Section ${g.sectionName}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {g.studentCount} student{g.studentCount === 1 ? "" : "s"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <Button
          className="mt-4 w-full"
          disabled={!canActivate || saving || includedCount === 0}
          onClick={handleSetup}
        >
          {saving
            ? "Setting up…"
            : `Setup Next Month — ${monthLabel(nextKey)} (${includedCount})`}
        </Button>
        {!canActivate && (
          <p className="mt-2 text-center text-xs text-amber-600">
            Available after the {setupDay}th of{" "}
            {monthLabel(fees.activeMonthKey)}
          </p>
        )}
        {canActivate && includedCount === 0 && classGroups.length > 0 && (
          <p className="mt-2 text-center text-xs text-amber-600">
            Every class is unticked — tick at least one to continue.
          </p>
        )}
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <p className="border-b px-5 py-3 text-sm font-semibold">
          Billing History
        </p>
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
