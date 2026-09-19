"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { apiMonthStatus, type ApiMonthStatus } from "@/lib/attendance/api";

/**
 * One month of a register at a glance: what is done, what is missing.
 *
 * A school entering months it kept on paper needs to see which days are still
 * outstanding. Without this the only way to find out is to open all thirty-one
 * of them one at a time — and a day nobody marked looks exactly like a day
 * everybody was present, because the rows open on the school's default status.
 */
export function MonthGrid({
  classId,
  sectionId,
  shiftId,
  month,
  refreshKey,
  onPickDay,
}: {
  classId: string;
  sectionId: string | null;
  shiftId: string | null;
  /** "YYYY-MM". */
  month: string;
  /** Change this to make the grid re-read after a save. */
  refreshKey?: number;
  onPickDay: (date: string) => void;
}) {
  const t = useT();
  const [data, setData] = useState<ApiMonthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId || !month) return;
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return;
    let live = true;
    setLoading(true);
    setError(null);
    apiMonthStatus({ classId, year: y, month: m, sectionId, shiftId })
      .then((res) => {
        if (live) setData(res);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Failed to load.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [classId, sectionId, shiftId, month, refreshKey]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-rose-600 dark:text-rose-400">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const done = data.days.filter((d) => d.marked > 0).length;
  const available = data.days.filter((d) => !d.future).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          {t("attendanceBackfill.progress")
            .replace("{done}", String(done))
            .replace("{total}", String(available))}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Legend className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
            {t("attendanceBackfill.legendTaken")}
          </Legend>
          <Legend className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
            {t("attendanceBackfill.legendMissing")}
          </Legend>
          <Legend className="bg-secondary text-muted-foreground border-input">
            {t("attendanceBackfill.legendFuture")}
          </Legend>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {data.days.map((d) => {
          const taken = d.marked > 0;
          const dayNumber = Number(d.date.slice(8));
          return (
            <button
              key={d.date}
              type="button"
              disabled={d.future}
              onClick={() => onPickDay(d.date)}
              title={d.date}
              className={cn(
                "rounded-lg border px-2 py-2.5 text-start transition-all",
                d.future
                  ? "cursor-not-allowed border-input bg-secondary/60 opacity-50"
                  : taken
                    ? "border-emerald-500/30 bg-emerald-500/15 hover:-translate-y-0.5 hover:shadow-sm"
                    : "border-amber-500/30 bg-amber-500/10 hover:-translate-y-0.5 hover:shadow-sm",
              )}
            >
              <span className="block text-base font-bold leading-none tabular-nums">
                {dayNumber}
              </span>
              <span
                className={cn(
                  "mt-1 block truncate text-[11px]",
                  taken
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground",
                )}
              >
                {d.future
                  ? t("attendanceBackfill.legendFuture")
                  : taken
                    ? `${d.marked}/${data.onRoll}`
                    : t("attendanceBackfill.legendMissing")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded border", className)} />
      {children}
    </span>
  );
}
