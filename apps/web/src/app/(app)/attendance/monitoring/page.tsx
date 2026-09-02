"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClockAlert,
  Eye,
  TriangleAlert,
} from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import {
  apiAttendanceMonitoring,
  apiOfficerPerformance,
  type MonitoringRegister,
  type OfficerPerformance,
} from "@/lib/attendance/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/**
 * What the school can see about its own registers.
 *
 * The marks were always visible; the taking was not. A register nobody
 * touched looks exactly like a class where everybody turned up, so a missed
 * afternoon surfaced weeks later as a gap in a report — if at all. This says
 * plainly which registers are outstanding while the day can still be fixed,
 * who took the rest, and when.
 */
export default function AttendanceMonitoringPage() {
  const t = useT();
  const [tab, setTab] = useState("day");

  return (
    <div className="space-y-6">
      <Link
        href="/attendance"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("attendanceMonitoring.back")}
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Eye className="h-6 w-6 text-primary" />
          {t("attendanceMonitoring.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("attendanceMonitoring.description")}
        </p>
      </div>

      <Tabs
        tabs={[
          { id: "day", label: t("attendanceMonitoring.tabDay") },
          { id: "officers", label: t("attendanceMonitoring.tabOfficers") },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "day" ? <DayView /> : <OfficerView />}
    </div>
  );
}

function DayView() {
  const t = useT();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<MonitoringRegister[]>([]);
  const [lockTime, setLockTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (d: string) => {
      setLoading(true);
      try {
        const res = await apiAttendanceMonitoring(d);
        setRows(res.registers);
        setLockTime(res.lockTime);
      } catch {
        toast(t("attendanceMonitoring.loadFailed"), "error");
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

  const untaken = rows.filter((r) => r.state === "NOT_TAKEN").length;
  const partial = rows.filter((r) => r.state === "PARTIAL").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("attendanceMonitoring.date")}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          />
        </label>
        {lockTime && (
          <p className="pb-2 text-xs text-muted-foreground">
            {t("attendanceMonitoring.lockAt", { time: lockTime })}
          </p>
        )}
      </div>

      {!loading && rows.length > 0 && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            untaken === 0 && partial === 0
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
          )}
        >
          {untaken === 0 && partial === 0 ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {t("attendanceMonitoring.allTaken")}
            </>
          ) : (
            <>
              <TriangleAlert className="h-4 w-4 shrink-0" />
              {t("attendanceMonitoring.outstanding", {
                untaken,
                partial,
              })}
            </>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">{t("attendanceMonitoring.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("attendanceMonitoring.noClasses")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceMonitoring.register")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceMonitoring.status")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceMonitoring.marked")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceMonitoring.takenBy")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceMonitoring.at")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.classId}-${r.shiftId ?? ""}`}
                  className={cn(
                    "border-t",
                    r.state === "NOT_TAKEN" && "bg-rose-500/[0.04]",
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.className}</p>
                    {r.shiftName && (
                      <p className="text-xs text-muted-foreground">
                        {r.shiftName}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        r.state === "TAKEN"
                          ? "success"
                          : r.state === "PARTIAL"
                            ? "warning"
                            : r.state === "EMPTY"
                              ? "muted"
                              : "danger"
                      }
                    >
                      {t(`attendanceMonitoring.state${r.state}` as never)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.marked} / {r.total}
                    {r.marked > 0 && (
                      <span className="ms-2 text-xs text-muted-foreground">
                        {r.present}P · {r.absent}A
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.takenBy.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {r.takenBy.map((u) => (
                          <Badge key={u.userId} tone="muted">
                            {u.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.firstMarkedAt ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          r.afterLock && "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {r.afterLock && <ClockAlert className="h-3.5 w-3.5" />}
                        {new Date(r.firstMarkedAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OfficerView() {
  const t = useT();
  const [from, setFrom] = useState(daysAgoISO(29));
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<OfficerPerformance[]>([]);
  const [schoolDays, setSchoolDays] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiOfficerPerformance(from, to);
      setRows(res.officers);
      setSchoolDays(res.schoolDays);
    } catch {
      toast(t("attendanceMonitoring.loadFailed"), "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("attendanceMonitoring.from")}
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("attendanceMonitoring.to")}
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          />
        </label>
        {!loading && (
          <p className="pb-2 text-xs text-muted-foreground">
            {t("attendanceMonitoring.schoolDays", { count: schoolDays })}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("attendanceMonitoring.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("attendanceMonitoring.noOfficers")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceMonitoring.officer")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceMonitoring.assigned")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceMonitoring.taken")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceMonitoring.missed")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceMonitoring.rate")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.userId} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">{o.username}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {o.assignments === 0 ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {t("attendanceMonitoring.nothingAssigned")}
                      </span>
                    ) : (
                      o.assignments
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {o.taken} / {o.expected}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {o.missed > 0 ? (
                      <span className="font-medium text-rose-600 dark:text-rose-400">
                        {o.missed}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {/* No rate for an officer with nothing assigned: 0% would
                        read as neglect when the gap is in the setup. */}
                    {o.rate === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          o.rate >= 90
                            ? "text-emerald-600 dark:text-emerald-400"
                            : o.rate >= 60
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {o.rate}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
