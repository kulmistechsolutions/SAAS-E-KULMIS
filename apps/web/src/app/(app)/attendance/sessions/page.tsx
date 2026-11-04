"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { activeAcademicYear, refreshAcademics, useAcademicsState } from "@/lib/academics/store";
import { apiAttendanceSessions, type ApiAttendanceSessions } from "@/lib/attendance/api";
import { todayISO } from "@/lib/attendance/format";
import { toast } from "@/lib/toast";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

const CELL: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: "P", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  ABSENT: { label: "A", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  LATE: { label: "L", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  EXCUSED: { label: "E", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
};

type Filter = "ALL" | "MISSED" | "ABSENT_ALL";

/**
 * One day of a class with every roll call side by side, so the child who
 * was there at the first register and gone by the second stands out.
 */
export default function AttendanceSessionsPage() {
  const t = useT();
  const mounted = useHydrated();
  const academics = useAcademicsState();
  const [date, setDate] = useState(todayISO());
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [data, setData] = useState<ApiAttendanceSessions | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mounted) void refreshAcademics();
  }, [mounted]);

  const classes = useMemo(() => {
    const year = activeAcademicYear();
    return academics.classes.filter((c) => !year || c.academicYear === year);
  }, [academics.classes]);
  const sections = useMemo(
    () => academics.sections.filter((s) => s.classId === classId),
    [academics.sections, classId],
  );

  async function load() {
    if (!classId) return toast(t("attendanceSessions.pickClass"), "error");
    setLoading(true);
    try {
      setData(await apiAttendanceSessions(classId, date, sectionId || null));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    if (!data) return [];
    if (filter === "MISSED") return data.rows.filter((r) => r.missedSome);
    if (filter === "ABSENT_ALL") return data.rows.filter((r) => r.absentAll);
    return data.rows;
  }, [data, filter]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <Link
        href="/attendance"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("attendanceStudents.backToAttendance")}
      </Link>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold">{t("attendanceSessions.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("attendanceSessions.description")}</p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-secondary/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("attendanceStudents.date")}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("attendanceStudents.class")}
          </label>
          <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }}>
            <option value="">{t("attendanceStudents.selectClass")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("attendanceStudents.section")}
          </label>
          <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={sections.length === 0}>
            <option value="">{t("attendanceSessions.allSections")}</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => void load()} disabled={loading} className="w-full">
            {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {t("attendanceSessions.show")}
          </Button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["ALL", t("attendanceSessions.students"), data.summary.students, "text-foreground"],
                ["MISSED", t("attendanceSessions.missedSome"), data.summary.missedSome, "text-amber-600 dark:text-amber-400"],
                ["ABSENT_ALL", t("attendanceSessions.absentAll"), data.summary.absentAll, "text-rose-600 dark:text-rose-400"],
              ] as const
            ).map(([key, label, n, cls]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-2xl border bg-card p-4 text-start shadow-sm transition-colors",
                  filter === key ? "border-primary ring-1 ring-primary" : "hover:bg-secondary/40",
                )}
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("mt-1 text-2xl font-bold tabular-nums", cls)}>{n}</p>
              </button>
            ))}
          </div>

          {data.columns.length === 0 ? (
            <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              {t("attendanceSessions.noShifts")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-start font-medium">S/N</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("attendanceSessions.student")}</th>
                    {data.columns.map((c, i) => (
                      <th key={c.id ?? "none"} className="px-3 py-2.5 text-center font-medium">
                        <span className="block">{c.name}</span>
                        <span className="block font-normal">
                          {c.startTime ? `${c.startTime} · ` : ""}
                          {t("attendanceSessions.taken", { n: data.taken[i] ?? 0 })}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-start font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={cn("border-t", r.missedSome && "bg-amber-500/5")}>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.serialNo ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{r.fullName}</span>
                        <span className="ms-2 text-xs text-muted-foreground">{r.code}</span>
                      </td>
                      {r.statuses.map((st, i) => (
                        <td key={i} className="px-3 py-2 text-center">
                          {st ? (
                            <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold", CELL[st]?.cls)}>
                              {CELL[st]?.label ?? st}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {r.missedSome ? (
                          <Badge tone="warning">{t("attendanceSessions.missedSomeBadge")}</Badge>
                        ) : r.absentAll ? (
                          <Badge tone="danger">{t("attendanceSessions.absentAllBadge")}</Badge>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">{t("attendanceSessions.nobody")}</p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("attendanceSessions.legend")}</p>
        </>
      )}
    </div>
  );
}
