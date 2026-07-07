"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  GraduationCap,
  Info,
  Receipt,
  School,
  Sparkles,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { StatCard, type StatTheme } from "@/components/dashboard/stat-card";
import {
  AdmissionAreaChart,
  AttendanceDonut,
  FeeAreaChart,
  IncomeExpenseBars,
} from "@/components/dashboard/charts";
import { cn } from "@/lib/utils";
import {
  admissionTrend,
  alerts,
  attendanceBreakdown,
  feeCollection,
  incomeVsExpense,
  quickActions,
  recentActivities,
  stats,
  systemInfo,
  topClasses,
  upcomingExams,
} from "@/lib/dashboard-data";

const STAT_ICONS: Record<string, LucideIcon> = {
  students: Users,
  teachers: GraduationCap,
  parents: UsersRound,
  classes: School,
  fees: DollarSign,
  attendance: CalendarCheck,
};

const ACTION_ICONS: Record<string, LucideIcon> = {
  "add-student": UserPlus,
  "collect-fees": DollarSign,
  attendance: CalendarCheck,
  exam: FileText,
  quiz: ClipboardList,
  expense: Receipt,
  report: BarChart3,
  notice: Bell,
  calendar: CalendarDays,
};

const ALERT_ICONS: Record<string, LucideIcon> = {
  alert: AlertTriangle,
  info: Info,
  check: CheckCircle2,
};

/** Quick actions whose target page already exists navigate there; the rest
 * show a "coming soon" toast so every button responds. */
const ACTION_ROUTES: Record<string, string> = {
  "Add Student": "/students",
  "Take Attendance": "/attendance",
};

const ACTION_THEME: Record<StatTheme, string> = {
  violet: "bg-violet-500/10 text-violet-600 hover:bg-violet-500/15 dark:text-violet-400",
  emerald: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400",
  sky: "bg-sky-500/10 text-sky-600 hover:bg-sky-500/15 dark:text-sky-400",
  rose: "bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 dark:text-rose-400",
  teal: "bg-teal-500/10 text-teal-600 hover:bg-teal-500/15 dark:text-teal-400",
};

const ALERT_TONE: Record<string, string> = {
  rose: "text-rose-500",
  amber: "text-amber-500",
  sky: "text-sky-500",
  emerald: "text-emerald-500",
};

function Panel({
  title,
  action,
  onAction,
  id,
  className,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "animate-fade-up flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {action && (
          <button
            onClick={onAction}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  function runAction(label: string) {
    const href = ACTION_ROUTES[label];
    if (href) router.push(href);
    else toast(`${label} — coming soon`, "info");
  }

  function scrollToQuickActions() {
    document
      .getElementById("quick-actions")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const name = user?.username
    ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
    : "Admin";
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Welcome back, {name}! <span className="align-middle">👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening in your school today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {today}
          </span>
          <button
            onClick={scrollToQuickActions}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <Sparkles className="h-4 w-4" />
            Quick Actions
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <StatCard
            key={s.key}
            label={s.label}
            value={s.value}
            hint={s.hint}
            hintTone={s.hintTone === "up" ? "up" : "muted"}
            theme={s.theme}
            icon={STAT_ICONS[s.icon]}
          />
        ))}
      </div>

      {/* Attendance / Fee / Income row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Attendance donut */}
        <Panel title="Attendance Overview (Today)">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative w-full max-w-[220px]">
              <AttendanceDonut segments={attendanceBreakdown.segments} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">92.4%</span>
                <span className="text-xs text-muted-foreground">Present</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              {attendanceBreakdown.segments.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="ml-auto font-medium text-foreground">
                    {s.value.toLocaleString()}{" "}
                    <span className="text-muted-foreground">({s.percent})</span>
                  </span>
                </div>
              ))}
              <div className="border-t pt-3 text-sm text-muted-foreground">
                Total Students:{" "}
                <span className="font-semibold text-foreground">
                  {attendanceBreakdown.total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Panel>

        {/* Fee collection */}
        <Panel title="Fee Collection Overview (This Month)">
          <p className="text-xs text-muted-foreground">Total Collected</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {feeCollection.total}
            </span>
          </div>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {feeCollection.change}
          </span>
          <div className="mt-3">
            <FeeAreaChart data={feeCollection.series} />
          </div>
        </Panel>

        {/* Income vs expense */}
        <Panel title="Income vs Expense (This Month)">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Income
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              Expenses
            </span>
          </div>
          <div className="mt-2">
            <IncomeExpenseBars data={incomeVsExpense.series} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
            <div>
              <p className="text-muted-foreground">Income</p>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                {incomeVsExpense.income}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Expenses</p>
              <p className="font-semibold text-rose-600 dark:text-rose-400">
                {incomeVsExpense.expenses}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Net Income</p>
              <p className="font-semibold text-foreground">
                {incomeVsExpense.netIncome}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Exams / Activities / Alerts / Quick actions row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Upcoming exams */}
        <Panel
          title="Upcoming Exams"
          action="View All"
          onAction={() => toast("Examinations module — coming soon", "info")}
        >
          <ul className="space-y-3">
            {upcomingExams.map((e) => (
              <li
                key={e.title}
                className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-secondary/50"
              >
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="text-sm font-bold leading-none">{e.day}</span>
                  <span className="text-[10px] font-medium">{e.month}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {e.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.subtitle}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </Panel>

        {/* Recent activities */}
        <Panel
          title="Recent Activities"
          action="View All"
          onAction={() => toast("Activity log — coming soon", "info")}
        >
          <ul className="space-y-4">
            {recentActivities.map((a) => (
              <li key={a.text} className="flex items-start gap-3 text-sm">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                />
                <span className="text-foreground">{a.text}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Alerts */}
        <Panel
          title="Alerts & Notifications"
          action="View All"
          onAction={() => toast("Notifications — coming soon", "info")}
        >
          <ul className="space-y-3">
            {alerts.map((a) => {
              const Icon = ALERT_ICONS[a.icon];
              return (
                <li key={a.text} className="flex items-start gap-3 text-sm">
                  <Icon
                    className={cn("mt-0.5 h-4 w-4 shrink-0", ALERT_TONE[a.tone])}
                  />
                  <span className="text-foreground">{a.text}</span>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* Quick actions grid */}
        <Panel title="Quick Actions" id="quick-actions">
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((q) => {
              const Icon = ACTION_ICONS[q.icon];
              return (
                <button
                  key={q.label}
                  onClick={() => runAction(q.label)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors",
                    ACTION_THEME[q.theme],
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] font-medium leading-tight">
                    {q.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Admission trend / Top classes / System info row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {/* Admission trend */}
        <Panel title="Student Admission Trend" className="xl:col-span-2">
          <AdmissionAreaChart data={admissionTrend} />
        </Panel>

        {/* Top classes */}
        <Panel
          title="Top Classes by Strength"
          action="View All"
          onAction={() => router.push("/students")}
        >
          <ul className="space-y-4">
            {topClasses.map((c) => (
              <li key={c.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.label}</span>
                  <span className="font-medium tabular-nums text-muted-foreground">
                    {c.value}/{c.capacity}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                    style={{ width: `${(c.value / c.capacity) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* System information */}
        <Panel title="System Information">
          <ul className="divide-y">
            {systemInfo.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-muted-foreground">{s.label}</span>
                {s.tone === "success" ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {s.value}
                  </span>
                ) : (
                  <span className="font-medium text-foreground">{s.value}</span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
