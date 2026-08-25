"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  GraduationCap,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import {
  askCopilot,
  fetchCopilotBrief,
  fetchCopilotHistory,
  fetchCopilotOverview,
  fetchCopilotQuota,
  fetchCopilotRisks,
  fetchCopilotStudents,
  type CopilotBrief,
  type CopilotHistoryItem,
  type CopilotOverview,
  type CopilotQuota,
  type CopilotRisks,
  type CopilotStudents,
  type NamedTotal,
} from "@/lib/copilot/api";
import { money } from "@/lib/students/format";
import { useT, useI18n } from "@/lib/i18n/provider";
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
  deltaSuffix,
  icon: Icon,
  tone = "text-primary",
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  deltaSuffix?: string;
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
          {delta}
          {deltaSuffix}
        </p>
      )}
    </div>
  );
}

/** A category list that shows each share against the biggest one. */
function Breakdown({
  title,
  rows,
  tone,
  empty,
  entries,
}: {
  title: string;
  rows: NamedTotal[];
  tone: string;
  empty: string;
  entries: (n: number) => string;
}) {
  const top = rows.length > 0 ? Math.max(...rows.map((r) => r.amount)) : 0;
  return (
    <div className={CARD}>
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.slice(0, 8).map((r) => (
            <li key={r.name} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{r.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{money(r.amount)}</span>
              </div>
              <Bar value={top > 0 ? (r.amount / top) * 100 : 0} tone={tone} />
              <p className="text-xs text-muted-foreground">{entries(r.count)}</p>
            </li>
          ))}
        </ul>
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
  const t = useT();
  const { lang } = useI18n();
  const [overview, setOverview] = useState<CopilotOverview | null>(null);
  const [students, setStudents] = useState<CopilotStudents | null>(null);
  const [risks, setRisks] = useState<CopilotRisks | null>(null);
  const [brief, setBrief] = useState<CopilotBrief | null>(null);
  const [quota, setQuota] = useState<CopilotQuota | null>(null);
  const [history, setHistory] = useState<CopilotHistoryItem[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [askNote, setAskNote] = useState<string | null>(null);
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
      // The written summary and the allowance are secondary — the figures
      // above must render even when AI is switched off or the key expires.
      void fetchCopilotBrief(undefined, lang).then(setBrief).catch(() => setBrief(null));
      void fetchCopilotQuota().then(setQuota).catch(() => setQuota(null));
      void fetchCopilotHistory().then(setHistory).catch(() => setHistory([]));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  const submitQuestion = useCallback(async () => {
    const q = question.trim();
    if (q.length < 3 || asking) return;
    setAsking(true);
    setAnswer(null);
    setAskNote(null);
    try {
      const res = await askCopilot(q, lang);
      if (res.ok) {
        setAnswer(res.answer);
        setQuestion("");
        setQuota((prev) =>
          prev ? { ...prev, used: prev.limit - res.remaining, remaining: res.remaining } : prev,
        );
        void fetchCopilotHistory().then(setHistory).catch(() => undefined);
      } else if (res.reason === "limit") {
        setAskNote(t("copilot.limitReached"));
      } else {
        setAskNote(t("copilot.askUnavailable"));
      }
    } catch {
      setAskNote(t("copilot.askFailed"));
    } finally {
      setAsking(false);
    }
  }, [asking, question, lang, t]);

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
          <h1 className="text-2xl font-bold">{t("copilot.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {overview
              ? t("copilot.subtitle", {
                  from: overview.period.from,
                  to: overview.period.to,
                  year: overview.period.academicYear ? ` · ${overview.period.academicYear}` : "",
                })
              : t("copilot.subtitleFallback")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          aria-label={t("copilot.refresh")}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {failed && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("copilot.loadFailed")}
        </div>
      )}

      {brief && !brief.available && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {t("copilot.briefUnavailable")}
        </p>
      )}

      {brief?.available && brief.summary && (
        <div className={cn(CARD, "border-primary/25 bg-primary/[0.03]")}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("copilot.briefTitle")}
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {brief.summary}
          </p>
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground/70">
            {t("copilot.briefFooter", { from: brief.period.from, to: brief.period.to })}
          </p>
        </div>
      )}

      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={t("copilot.students")}
              value={overview.students.total.toLocaleString()}
              hint={t("copilot.maleFemale", {
                male: overview.students.male,
                female: overview.students.female,
              })}
              icon={Users}
            />
            <Stat
              label={t("copilot.collected")}
              value={money(overview.fees.collectedThisMonth)}
              hint={t("copilot.collectedHint", {
                today: money(overview.fees.collectedToday),
                rate: pct(overview.fees.collectionRate),
              })}
              icon={Wallet}
              tone="text-emerald-600 dark:text-emerald-400"
            />
            <Stat
              label={t("copilot.attendance")}
              value={pct(overview.attendance.monthRate)}
              hint={t("copilot.attendanceHint", {
                inCount: overview.attendance.todayPresent,
                outCount: overview.attendance.todayAbsent,
              })}
              delta={attDelta}
              deltaSuffix={t("copilot.vsLastMonth", { delta: "" })}
              icon={CalendarCheck}
              tone="text-sky-600 dark:text-sky-400"
            />
            <Stat
              label={t("copilot.netIncome")}
              value={money(overview.finance.netIncome)}
              hint={t("copilot.netIncomeHint", {
                inAmount: money(overview.finance.totalIncome),
                outAmount: money(overview.finance.salaries + overview.finance.expenses),
              })}
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
              <h2 className="font-semibold">{t("copilot.moneyTitle")}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  { k: t("copilot.feesCollected"), v: overview.finance.feeIncome, tone: "text-emerald-600 dark:text-emerald-400" },
                  { k: t("copilot.additionalIncome"), v: overview.finance.otherIncome, tone: "text-emerald-600 dark:text-emerald-400" },
                  { k: t("copilot.salariesPaid"), v: -overview.finance.salaries, tone: "text-rose-600 dark:text-rose-400" },
                  { k: t("copilot.expenses"), v: -overview.finance.expenses, tone: "text-rose-600 dark:text-rose-400" },
                ].map((row) => (
                  <div key={row.k} className="flex items-center justify-between">
                    <dt className="text-muted-foreground">{row.k}</dt>
                    <dd className={cn("font-semibold tabular-nums", row.tone)}>
                      {row.v < 0 ? `−${money(Math.abs(row.v))}` : money(row.v)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-3">
                  <dt className="font-medium">{t("copilot.netIncome")}</dt>
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
                  <span>{t("copilot.feeCollection")}</span>
                  <span>
                    {money(overview.fees.collectedThisMonth)} of {money(overview.fees.expectedThisMonth)}
                  </span>
                </div>
                <Bar value={overview.fees.collectionRate ?? 0} tone="bg-emerald-500" />
                <p className="text-xs text-muted-foreground">
                  {t("copilot.outstandingAll", { amount: money(overview.fees.outstanding) })}
                </p>
              </div>
              {/* "Collected $X" alone hides whether that came from a few
                  families paying in full or most paying part — the question a
                  principal actually asks next. */}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                <div>
                  <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {overview.fees.studentsPaidFull}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("copilot.paidFull")}</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {overview.fees.studentsPartial}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("copilot.paidPart")}</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    {overview.fees.studentsUnpaid}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("copilot.paidNone")}</p>
                </div>
              </div>
            </div>

            <div className={CARD}>
              <h2 className="font-semibold">{t("copilot.schoolToday")}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  {
                    k: t("copilot.teachers"),
                    v: `${overview.staff.teachers}`,
                    s: t("copilot.teacherAtt", { rate: pct(overview.teacherAttendance.rate) }),
                  },
                  { k: t("copilot.parents"), v: `${overview.staff.parents}`, s: t("copilot.parentsHint") },
                  {
                    k: t("copilot.classesSections"),
                    v: `${overview.academics.classes} / ${overview.academics.sections}`,
                    s: t("copilot.examsRecorded", { count: overview.academics.exams }),
                  },
                  {
                    k: t("copilot.newStudents"),
                    v: `${overview.students.newThisMonth}`,
                    s: t("copilot.newStudentsHint"),
                  },
                  {
                    k: t("copilot.quizzesSat"),
                    v: `${overview.quiz.attempts}`,
                    s:
                      overview.quiz.averagePercent != null
                        ? t("copilot.quizHint", {
                            avg: `${overview.quiz.averagePercent}%`,
                            pass: pct(overview.quiz.passRate),
                          })
                        : t("copilot.quizNone"),
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

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Payroll on its own: "salaries paid" alone never says how much
                of the wage bill that was, which is the question managers ask. */}
            <div className={CARD}>
              <h2 className="font-semibold">{t("copilot.payrollTitle")}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("copilot.payrollDue")}</dt>
                  <dd className="font-semibold tabular-nums">{money(overview.breakdown.salary.due)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("copilot.payrollPaid")}</dt>
                  <dd className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {money(overview.breakdown.salary.paid)}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <dt className="font-medium">{t("copilot.payrollLeft")}</dt>
                  <dd className="font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    {money(overview.breakdown.salary.outstanding)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 space-y-1.5">
                <Bar
                  value={
                    overview.breakdown.salary.due > 0
                      ? (overview.breakdown.salary.paid / overview.breakdown.salary.due) * 100
                      : 0
                  }
                  tone="bg-sky-500"
                />
                <p className="text-xs text-muted-foreground">
                  {t("copilot.payrollStaff", {
                    paid: overview.breakdown.salary.fullyPaid,
                    total: overview.breakdown.salary.staffCount,
                  })}
                </p>
              </div>
            </div>

            <Breakdown
              title={t("copilot.expenseBreakdown")}
              rows={overview.breakdown.expenseByCategory}
              tone="bg-rose-500"
              empty={t("copilot.nothingRecorded")}
              entries={(n) => t("copilot.entries", { count: n })}
            />
            <Breakdown
              title={t("copilot.incomeBreakdown")}
              rows={overview.breakdown.incomeByCategory}
              tone="bg-emerald-500"
              empty={t("copilot.nothingRecorded")}
              entries={(n) => t("copilot.entries", { count: n })}
            />
          </div>

          {/* One month's collection means little without the months around it. */}
          <div className={CARD}>
            <h2 className="font-semibold">{t("copilot.sixMonths")}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-2 font-medium">&nbsp;</th>
                    <th className="pb-2 text-right font-medium">{t("copilot.billed")}</th>
                    <th className="pb-2 text-right font-medium">{t("copilot.collectedCol")}</th>
                    <th className="w-1/3 pb-2 ps-4 font-medium">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.breakdown.months.map((m) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="py-2 font-medium tabular-nums">{m.month}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {money(m.expected)}
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {money(m.collected)}
                      </td>
                      <td className="py-2 ps-4">
                        <Bar
                          value={m.expected > 0 ? (m.collected / m.expected) * 100 : 0}
                          tone="bg-emerald-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={CARD}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="h-4 w-4 text-amber-500" />
            {t("copilot.topStudents")}
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
                ? t("copilot.noneYet")
                : t("copilot.loading")}
            </p>
          )}
        </div>

        <div className={CARD}>
          <h2 className="flex items-center gap-2 font-semibold">
            <GraduationCap className="h-4 w-4 text-sky-500" />
            {t("copilot.needsAttention")}
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
              {students ? t("copilot.nothingOutstanding") : t("copilot.loading")}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={CARD}>
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {t("copilot.lowAttendance")}
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
              {risks ? t("copilot.nothingOutstanding") : t("copilot.loading")}
            </p>
          )}
        </div>

        <div className={CARD}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Wallet className="h-4 w-4 text-rose-500" />
            {t("copilot.owingMost")}
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
              {risks ? t("copilot.nothingOutstanding") : t("copilot.loading")}
            </p>
          )}
        </div>
      </div>

      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageSquare className="h-4 w-4 text-primary" />
            {t("copilot.askTitle")}
          </h2>
          {quota && (
            <span className="text-xs text-muted-foreground">
              {t("copilot.quotaLeft", { remaining: quota.remaining, limit: quota.limit })}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("copilot.askHelp")}</p>
        <div className="mt-3 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitQuestion();
              }
            }}
            placeholder={t("copilot.askPlaceholder")}
            maxLength={500}
            disabled={asking || quota?.remaining === 0}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void submitQuestion()}
            disabled={asking || question.trim().length < 3 || quota?.remaining === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Send className={cn("h-4 w-4", asking && "animate-pulse")} />
            {asking ? t("copilot.asking") : t("copilot.askButton")}
          </button>
        </div>

        {askNote && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            {askNote}
          </p>
        )}
        {answer && (
          <p className="mt-3 whitespace-pre-line rounded-lg bg-secondary/60 p-3 text-sm leading-relaxed">
            {answer}
          </p>
        )}

        {history.length > 0 && (
          <details className="mt-4 border-t pt-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              {t("copilot.historyTitle", { count: history.length })}
            </summary>
            <ul className="mt-3 space-y-3">
              {history.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="font-medium">{h.question}</p>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">{h.answer}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {h.username ?? "—"} · {new Date(h.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
