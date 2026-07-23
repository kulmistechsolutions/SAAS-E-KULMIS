"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  apiMonthStatus,
  apiSetupMonth,
  type MonthStatusClass,
} from "@/lib/fees/api";
import { monthLabel, monthKey } from "@/lib/fees/format";
import { refreshFees } from "@/lib/fees/store";
import { toast } from "@/lib/toast";

/**
 * The deliberate "turn billing on for this month" step. Until a class is
 * activated here, registering a student into it charges nothing — billing
 * never starts on its own. The school picks every class or just some.
 */
export function MonthBillingSetup() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const label = monthLabel(monthKey(year, month));

  const [classes, setClasses] = useState<MonthStatusClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    void apiMonthStatus(year, month)
      .then((res) => setClasses(res.classes))
      .catch((e) =>
        toast(e instanceof Error ? e.message : "Could not load", "error"),
      )
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => load(), [load]);

  const pending = classes.filter((c) => !c.activated);
  const activatedCount = classes.length - pending.length;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runSetup(scope: "all" | "selected") {
    setBusy(true);
    try {
      const res = await apiSetupMonth({
        year,
        month,
        scope,
        classIds: scope === "selected" ? [...picked] : undefined,
      });
      toast(
        `Billing set up for ${label} — ${res.classesActivated} class(es), ` +
          `${res.charged} students charged.`,
        "success",
      );
      setPicked(new Set());
      load();
      await refreshFees();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Setup failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Wallet className="h-4 w-4 text-primary" />
        Set up this month&apos;s billing — {label}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Billing never starts on its own. Turn it on for every class at once, or
        pick specific classes. Only then are students charged, and only then can
        payments be collected.
      </p>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading classes…
        </p>
      ) : classes.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No active classes yet. Create classes first.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="success">{activatedCount} set up</Badge>
            <Badge tone={pending.length ? "warning" : "muted"}>
              {pending.length} not set up
            </Badge>
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border">
            {classes.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center justify-between gap-2 border-b px-3 py-2.5 text-sm last:border-0 hover:bg-secondary/40 ${
                  c.activated ? "opacity-70" : ""
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    disabled={c.activated || busy}
                    checked={c.activated || picked.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span>
                    {c.name}
                    <span className="ml-1 text-xs text-muted-foreground">
                      · {c.activeStudents} student
                      {c.activeStudents === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
                {c.activated ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Set up
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CircleDashed className="h-3.5 w-3.5" /> Pending
                  </span>
                )}
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              disabled={busy || pending.length === 0}
              onClick={() => void runSetup("all")}
            >
              {busy ? "Setting up…" : `Set up all classes (${pending.length})`}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy || picked.size === 0}
              onClick={() => void runSetup("selected")}
            >
              Set up selected ({picked.size})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
