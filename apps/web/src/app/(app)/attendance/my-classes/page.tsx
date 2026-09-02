"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Clock,
  TriangleAlert,
} from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiMyAttendanceDay, type MyDayRegister } from "@/lib/attendance/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * The registers this account holds, and how far each one has got today.
 *
 * An officer with four classes was previously left to work that out by
 * opening the marking screen four times and remembering what they saw. This
 * is the question they actually have — "what have I still not done?" — asked
 * once, which is also the only way the school finds out a register was missed
 * on the day rather than at the end of the month.
 */
export default function MyAttendanceClassesPage() {
  const t = useT();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<MyDayRegister[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (d: string) => {
      setLoading(true);
      try {
        const res = await apiMyAttendanceDay(d);
        setRows(res.registers);
      } catch {
        toast(t("myAttendanceClasses.loadFailed"), "error");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void load(date);
  }, [load, date]);

  const outstanding = rows.filter(
    (r) => r.state === "NOT_STARTED" || r.state === "PARTIAL",
  ).length;

  return (
    <div className="space-y-6">
      <Link
        href="/attendance"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("myAttendanceClasses.back")}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarCheck className="h-6 w-6 text-primary" />
            {t("myAttendanceClasses.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("myAttendanceClasses.description")}
          </p>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("myAttendanceClasses.date")}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          />
        </label>
      </div>

      {!loading && rows.length > 0 && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            outstanding === 0
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
          )}
        >
          {outstanding === 0 ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <TriangleAlert className="h-4 w-4 shrink-0" />
          )}
          {outstanding === 0
            ? t("myAttendanceClasses.allDone")
            : t("myAttendanceClasses.outstanding", { count: outstanding })}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">{t("myAttendanceClasses.loading")}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <CircleSlash className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{t("myAttendanceClasses.noneTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("myAttendanceClasses.noneHelp")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <RegisterCard key={r.id} r={r} date={date} />
          ))}
        </div>
      )}
    </div>
  );
}

function RegisterCard({ r, date }: { r: MyDayRegister; date: string }) {
  const t = useT();
  const pct = r.total === 0 ? 0 : Math.round((r.marked / r.total) * 100);

  const tone =
    r.state === "DONE"
      ? "success"
      : r.state === "PARTIAL"
        ? "warning"
        : r.state === "EMPTY"
          ? "muted"
          : "danger";

  const label = t(`myAttendanceClasses.state${r.state}` as never);

  const query = new URLSearchParams({ classId: r.classId, date });
  if (r.sectionId) query.set("sectionId", r.sectionId);
  if (r.shiftId) query.set("shiftId", r.shiftId);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {r.className}
            {r.sectionName ? ` · ${r.sectionName}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {r.shiftName ?? t("myAttendanceClasses.everyShift")}
          </p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t("myAttendanceClasses.markedOf", {
              marked: r.marked,
              total: r.total,
            })}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              r.state === "DONE" ? "bg-emerald-500" : "bg-amber-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {r.marked > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-emerald-600 dark:text-emerald-400">
            {t("myAttendanceClasses.present")}: {r.present}
          </span>
          <span className="text-rose-600 dark:text-rose-400">
            {t("myAttendanceClasses.absent")}: {r.absent}
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            {t("myAttendanceClasses.late")}: {r.late}
          </span>
          <span className="text-sky-600 dark:text-sky-400">
            {t("myAttendanceClasses.excused")}: {r.excused}
          </span>
        </div>
      )}

      {/* Two officers may share a register deliberately. When they do, the
          second one should know before marking, not after. */}
      {r.markedByOthers.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-700 dark:text-sky-300">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("myAttendanceClasses.alreadyTakenBy", {
            names: r.markedByOthers.join(", "),
          })}
        </p>
      )}

      <Link href={`/attendance/students?${query.toString()}`} className="mt-4 block">
        <Button
          variant={r.state === "DONE" ? "outline" : "default"}
          className="h-9 w-full"
          disabled={r.state === "EMPTY"}
        >
          {r.state === "EMPTY" ? (
            <>
              <CircleDashed className="me-2 h-4 w-4" />
              {t("myAttendanceClasses.nobodyEnrolled")}
            </>
          ) : (
            <>
              <CalendarCheck className="me-2 h-4 w-4" />
              {r.state === "DONE"
                ? t("myAttendanceClasses.review")
                : t("myAttendanceClasses.take")}
            </>
          )}
        </Button>
      </Link>
    </div>
  );
}
