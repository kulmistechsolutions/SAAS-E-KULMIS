"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Loader2, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import {
  apiBackfillState,
  apiCloseBackfill,
  apiOpenBackfill,
  type ApiBackfillState,
} from "@/lib/attendance/api";

/** "2026-08" → "2026-08-01". */
function firstDay(month: string): string {
  return `${month}-01`;
}

/** "2026-08" → "2026-08-31", never later than `cap`. */
function lastDay(month: string, cap: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const end = `${month}-${String(last).padStart(2, "0")}`;
  return end > cap ? cap : end;
}

/** Every month from the year's start up to and including the current one. */
function monthsUpTo(start: string, today: string): string[] {
  const out: string[] = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  const stop = today.slice(0, 7);
  for (let i = 0; i < 24; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= stop) break;
    m! += 1;
    if (m! > 12) {
      m = 1;
      y! += 1;
    }
  }
  return out;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Open and close catch-up marking.
 *
 * A school that joins halfway through the year has months of registers in an
 * exercise book and nowhere to put them: the attendance lock cannot tell that
 * apart from a register being quietly rewritten after the fact. So the school
 * says which months it is catching up on, does the work, and closes the window
 * again. It is deliberately not a switch that can be left on and forgotten —
 * it names its months, it records who opened it, and it says so on the marking
 * screen for as long as it is open.
 */
export function BackfillPanel() {
  const t = useT();
  const [state, setState] = useState<ApiBackfillState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function refresh() {
    try {
      const s = await apiBackfillState();
      setState(s);
      const months = s.academicYear
        ? monthsUpTo(s.academicYear.start, s.today)
        : [s.today.slice(0, 7)];
      // Defaults to the month before this one, which is what a school
      // catching up almost always wants first.
      const fallback = months[Math.max(0, months.length - 2)] ?? months[0]!;
      setFrom((f) => f || fallback);
      setTo((x) => x || fallback);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }
  if (!state) return null;

  const months = state.academicYear
    ? monthsUpTo(state.academicYear.start, state.today)
    : [state.today.slice(0, 7)];
  const isOpen = state.window?.open === true;

  async function open() {
    setBusy(true);
    try {
      await apiOpenBackfill(firstDay(from), lastDay(to, state!.today));
      await refresh();
      toast(t("attendanceBackfill.opened"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    setBusy(true);
    try {
      await apiCloseBackfill();
      await refresh();
      toast(t("attendanceBackfill.closed"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isOpen
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {isOpen ? (
            <LockOpen className="h-5 w-5" />
          ) : (
            <CalendarRange className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{t("attendanceBackfill.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("attendanceBackfill.description")}
          </p>
        </div>
      </div>

      {isOpen && state.window ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              {t("attendanceBackfill.openNow")
                .replace("{from}", state.window.from)
                .replace("{to}", state.window.to)}
            </p>
            {state.window.openedByName && state.window.openedAt && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("attendanceBackfill.openedBy")
                  .replace("{name}", state.window.openedByName)
                  .replace(
                    "{when}",
                    new Date(state.window.openedAt).toLocaleString(),
                  )}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("attendanceBackfill.closeHint")}
          </p>
          <Button variant="destructive" disabled={busy} onClick={() => void close()}>
            {busy ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="me-2 h-4 w-4" />
            )}
            {t("attendanceBackfill.close")}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("attendanceBackfill.fromMonth")}
              </label>
              <Select value={from} onChange={(e) => setFrom(e.target.value)}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("attendanceBackfill.toMonth")}
              </label>
              <Select value={to} onChange={(e) => setTo(e.target.value)}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {from > to && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {t("attendanceBackfill.backwards")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {state.academicYear
              ? t("attendanceBackfill.yearBound").replace(
                  "{year}",
                  state.academicYear.name,
                )
              : t("attendanceBackfill.noYear")}
          </p>
          <Button disabled={busy || from > to} onClick={() => void open()}>
            {busy ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <LockOpen className="me-2 h-4 w-4" />
            )}
            {t("attendanceBackfill.open")}
          </Button>
        </div>
      )}
    </div>
  );
}
