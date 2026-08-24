"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  GraduationCap,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import {
  fetchCopilotOverview,
  fetchCopilotRisks,
  fetchCopilotStudents,
  type CopilotOverview,
  type CopilotRisks,
  type CopilotStudents,
} from "@/lib/copilot/api";
import { money } from "@/lib/students/format";
import { cn } from "@/lib/utils";

const CARD = "rounded-xl border bg-card p-5 shadow-sm";

function pct(v: number | null): string {
  return v == null ? "—" : `${v}%`;
}

/** A figure with what it is, and where it moved. */
function Stat({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = "text-primary",
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  icon: typeof Users;
  tone?: string;
}) {
  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10", tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {delta != null && (
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-xs font-medium",
            delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
          )}
        >
          {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {delta >= 0 ? "+" : ""}
          {delta}pt vs last month
        </p>
      )}
    </div>
  );
}

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export default function CopilotPage() {
  const [overview, setOverview] = useState<CopilotOverview | null>(null);
  const [students, setStudents] = useState<CopilotStudents | null>(null);
  const [risks, setRisks] = useState<CopilotRisks | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s, r] = await Promise.all([
        fetchCopilotOverview(),
        fetchCopilotStudents(10),
        fetchCopilotRisks(),
      ]);
      setOverview(o);
      setStudents(s);
      setRisks(r);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const attDelta =
    overview?.attendance.monthRate != null && overview.attendance.previousMonthRate != null
      ? Math.round((overview.attendance.monthRate - overview.attendance.previousMonthRate) * 10) / 10
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">School Copilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {overview
              ? `Everything recorded for ${overview.period.from} – ${overview.period.to}${
                  overview.period.academicYear ? ` · ${overview.period.academicYear}` : ""
                }, in one place.`
              : "Your school's own figures, in one place."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {failed && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not load the school figures.
        </div>
      )}

      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Students"
              value={overview.students.total.toLocaleString()}
              hint={`${overview.students.male} male · ${overview.students.female} female`}
              icon={Users}
            />
            <Stat
              label="Collected this month"
              value={money(overview.fees.collectedThisMonth)}
              hint={`${money(overview.fees.collectedToday)} today · ${pct(overview.fees.collectionRate)} of expected`}
              icon={Wallet}
              tone="text-emerald-600 dark:text-emerald-400"
            />
            <Stat
              label="Attendance"
              value={pct(overview.attendance.monthRate)}
              hint={`${overview.attendance.todayPresent} in today, ${overview.attendance.todayAbsent} out`}
              delta={attDelta}
              icon={CalendarCheck}
              tone="text-sky-600 dark:text-sky-400"
            />
            <Stat
              label="Net income"
              value={money(overview.finance.netIncome)}
              hint={`${money(overview.finance.totalIncome)} in · ${money(
                overview.finance.salaries + overview.finance.expenses,
              )} out`}
              icon={TrendingUp}
              tone={
                overview.finance.netIncome >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Where the money went — the whole month on one line each. */}
            <div className={CARD}>
              <h2 className="font-semibold">This month&apos;s money</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  { k: "Fees collected", v: overview.finance.feeIncome, tone: "text-emerald-600 dark:text-emerald-400" },
                  { k: "Additional income", v: overview.finance.otherIncome, tone: "text-emerald-600 dark:text-emerald-400" },
                  { k: "Salaries paid", v: -overview.finance.salaries, tone: "text-rose-600 dark:text-rose-400" },
                  { k: "Expenses", v: -overview.finance.expenses, tone: "text-rose-600 dark:text-rose-400" },
                ].map((row) => (
                  <div key={row.k} className="flex items-center justify-between">
                    <dt className="text-muted-foreground">{row.k}</dt>
                    <dd className={cn("font-semibold tabular-nums", row.tone)}>
                      {row.v < 0 ? `−${money(Math.abs(row.v))}` : money(row.v)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-3">
                  <dt className="font-medium">Net income</dt>
                  <dd
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      overview.finance.netIncome >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {money(overview.finance.netIncome)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fee collection</span>
                  <span>
                    {money(overview.fees.collectedThisMonth)} of {money(overview.fees.expectedThisMonth)}
                  </span>
                </div>
                <Bar value={overview.fees.collectionRate ?? 0} tone="bg-emerald-500" />
                <p className="text-xs text-muted-foreground">
                  {money(overview.fees.outstanding)} still outstanding across all months.
                </p>
              </div>
            </div>

            <div className={CARD}>
              <h2 className="font-semibold">The school today</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  { k: "Teachers", v: `${overview.staff.teachers}`, s: `${pct(overview.teacherAttendance.rate)} attendance this month` },
                  { k: "Parents", v: `${overview.staff.parents}`, s: "with portal accounts" },
                  { k: "Classes / sections", v: `${overview.academics.classes} / ${overview.academics.sections}`, s: `${overview.academics.exams} exams recorded` },
                  { k: "New students", v: `${overview.students.newThisMonth}`, s: "registered this month" },
                  {
                    k: "Quizzes sat",
                    v: `${overview.quiz.attempts}`,
                    s:
                      overview.quiz.averagePercent != null
                        ? `${overview.quiz.averagePercent}% average · ${pct(overview.quiz.passRate)} passing`
                        : "none graded yet",
                  },
                ].map((row) => (
                  <div key={row.k} className="flex items-start justify-between gap-3">
                    <dt className="min-w-0">
                      <span className="text-muted-foreground">{row.k}</span>
                      <span className="block text-xs text-muted-foreground/70">{row.s}</span>
                    </dt>
                    <dd className="shrink-0 font-semibold tabular-nums">{row.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={CARD}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="h-4 w-4 text-amber-500" />
            Top students
          </h2>
          {students && students.top.length > 0 ? (
            <>
              <ol className="mt-3 space-y-2">
                {students.top.map((s, i) => (
                  <li key={s.studentId} className="flex items-center gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {s.name}
                      <span className="text-xs text-muted-foreground"> · {s.className ?? "—"}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{s.value}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Ranked on the {students.rankedOn}. {students.studentsRanked} students qualify
                {students.studentsUnranked > 0 && `, ${students.studentsUnranked} have too few marks to rank`}.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {students
                ? "There are not enough recorded exam marks to rank students yet."
                : "Loading…"}
            </p>
          )}
        </div>

        <div className={CARD}>
          <h2 className="flex items-center gap-2 font-semibold">
            <GraduationCap className="h-4 w-4 text-sky-500" />
            Needs attention
          </h2>
          {students && students.needsAttention.length > 0 ? (
            <ol className="mt-3 space-y-2">
              {students.needsAttention.map((s) => (
                <li key={s.studentId} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {s.name}
                    <span className="text-xs text-muted-foreground"> · {s.className ?? "—"}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {s.value}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {students ? "Nothing to flag from the recorded marks." : "Loading…"}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={CARD}>
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Attendance below 75%
          </h2>
          {risks && risks.lowAttendance.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {risks.lowAttendance.slice(0, 10).map((s) => (
                <li key={s.code} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {s.name}
                    <span className="text-xs text-muted-foreground"> · {s.className ?? "—"}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.daysRecorded}d</span>
                  <span className="shrink-0 font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {pct(s.rate)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {risks ? "Nobody is below 75% this month." : "Loading…"}
            </p>
          )}
        </div>

        <div className={CARD}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Wallet className="h-4 w-4 text-rose-500" />
            Owing the most
          </h2>
          {risks && risks.owing.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {risks.owing.slice(0, 10).map((s) => (
                <li key={s.code} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {s.name}
                    <span className="text-xs text-muted-foreground"> · {s.className ?? "—"}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {money(s.owed)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {risks ? "Nothing outstanding." : "Loading…"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
