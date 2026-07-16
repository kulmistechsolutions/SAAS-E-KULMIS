"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import {
  AdmissionAreaChart,
  AttendanceDonut,
  FeeAreaChart,
  IncomeExpenseBars,
} from "@/components/dashboard/charts";
import { cn } from "@/lib/utils";
import {
  apiAdminDashboard,
  money,
  type AdminDashboardResponse,
} from "@/lib/dashboard/api";
import { quickActions } from "@/lib/dashboard-data";

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

/** Turn an audit action code (e.g. "SETTINGS_UPDATED") into a sentence fragment ("Settings updated"). */
function humanizeAuditAction(action: string): string {
  const words = action.toLowerCase().split("_");
  return words.length ? words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1) + " " + words.slice(1).join(" ") : action;
}

/** Turn a module slug (e.g. "student-attendance") into "Student attendance". */
function humanizeAuditModule(module: string): string {
  const s = module.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ACTION_ROUTES: Record<string, string> = {
  "Add Student": "/students?add=1",
  "Collect Fees": "/finance/collect",
  "Take Attendance": "/attendance/students",
  "Create Exam": "/examinations/create",
  "Create Quiz": "/quiz/create",
  "Add Expense": "/expenses/list?add=1",
  "Generate Report": "/reports",
  "Send Notice": "/announcements?compose=1",
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

const ACTIVITY_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#22c55e",
];

function buildStats(data: AdminDashboardResponse) {
  const outstandingStudents = data.fees.partialPayments;
  return [
    {
      key: "students",
      label: "Total Students",
      value: data.students.total.toLocaleString(),
      hint: `+${data.students.newThisMonth} this month`,
      hintTone: "up" as const,
      icon: "students" as const,
      theme: "violet" as const,
    },
    {
      key: "teachers",
      label: "Total Teachers",
      value: data.teachers.total.toLocaleString(),
      hint: `${data.teachers.morning + data.teachers.afternoon} active`,
      hintTone: "muted" as const,
      icon: "teachers" as const,
      theme: "emerald" as const,
    },
    {
      key: "parents",
      label: "Total Parents",
      value: data.parents.total.toLocaleString(),
      hint: "Registered",
      hintTone: "muted" as const,
      icon: "parents" as const,
      theme: "amber" as const,
    },
    {
      key: "classes",
      label: "Total Classes",
      value: data.academics.classes.toLocaleString(),
      hint: `${data.academics.sections} Sections`,
      hintTone: "muted" as const,
      icon: "classes" as const,
      theme: "sky" as const,
    },
    {
      key: "fees",
      label: "Fees Outstanding",
      value: money(data.fees.totalOutstanding),
      hint: `${outstandingStudents} partial`,
      hintTone: "muted" as const,
      icon: "fees" as const,
      theme: "rose" as const,
    },
    {
      key: "attendance",
      label: "Today's Attendance",
      value: `${data.attendanceToday.percentage}%`,
      hint: "Present",
      hintTone: "muted" as const,
      icon: "attendance" as const,
      theme: "teal" as const,
    },
  ];
}

function buildAttendance(data: AdminDashboardResponse) {
  const { present, absent, late, total } = data.attendanceToday;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 1000) / 10}%` : "0%");
  return {
    total,
    segments: [
      { name: "Present", value: present, percent: pct(present), color: "#22c55e" },
      { name: "Absent", value: absent, percent: pct(absent), color: "#ef4444" },
      { name: "Late", value: late, percent: pct(late), color: "#f59e0b" },
    ],
  };
}

function buildAlerts(data: AdminDashboardResponse) {
  const alerts: { text: string; icon: "alert" | "info" | "check"; tone: string }[] = [];
  if (data.fees.totalOutstanding > 0) {
    alerts.push({
      text: `${money(data.fees.totalOutstanding)} in outstanding fees`,
      icon: "alert",
      tone: "rose",
    });
  }
  if (data.teacherAttendanceToday.absent > 0) {
    alerts.push({
      text: `${data.teacherAttendanceToday.absent} teachers absent today`,
      icon: "alert",
      tone: "amber",
    });
  }
  if (data.fees.partialPayments > 0) {
    alerts.push({
      text: `${data.fees.partialPayments} students with partial payments`,
      icon: "info",
      tone: "sky",
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      text: "All systems operating normally",
      icon: "check",
      tone: "emerald",
    });
  }
  return alerts;
}

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

async function fetchDashboardWithRetry(
  attempts = 3,
): Promise<AdminDashboardResponse> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await apiAdminDashboard();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === "TEACHER") {
    return <TeacherDashboard />;
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadDashboard = useCallback(async (showToastOnError = true) => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetchDashboardWithRetry();
      setData(res);
    } catch {
      setData(null);
      setLoadError(true);
      if (showToastOnError) toast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadDashboard();
  }, [user, loadDashboard]);

  const stats = useMemo(() => (data ? buildStats(data) : []), [data]);
  const attendanceBreakdown = useMemo(
    () => (data ? buildAttendance(data) : null),
    [data],
  );
  const feeCollection = useMemo(() => {
    if (!data) return null;
    const total = data.fees.collectedThisMonth;
    return {
      total: money(total),
      change: `${money(data.fees.collectedToday)} collected today`,
      series: data.charts.feeCollection.map((p) => ({
        label: p.label,
        value: p.value,
      })),
    };
  }, [data]);
  const incomeVsExpense = useMemo(() => {
    if (!data) return null;
    const { finance, charts } = data;
    return {
      income: money(finance.totalIncome),
      expenses: money(finance.totalExpenses),
      netIncome: money(finance.netIncome),
      series: charts.incomeVsExpense.map((p) => ({
        label: p.label,
        income: p.income,
        expense: p.expense,
      })),
    };
  }, [data]);
  const recentActivities = useMemo(() => {
    if (!data) return [];
    return data.recentActivities.map((a, i) => ({
      id: a.id,
      text: `${humanizeAuditAction(a.action)} · ${humanizeAuditModule(a.module)} (${a.username})`,
      color: ACTIVITY_COLORS[i % ACTIVITY_COLORS.length]!,
    }));
  }, [data]);
  const upcomingExams = useMemo(() => {
    if (!data) return [];
    return data.upcomingExams.map((e) => {
      const d = new Date(e.date);
      return {
        id: e.id,
        day: d.toLocaleDateString(undefined, { day: "2-digit" }),
        month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
        title: e.title,
        subtitle: `${e.className}${e.section ? ` - ${e.section}` : " - All Sections"}`,
      };
    });
  }, [data]);
  const alerts = useMemo(() => (data ? buildAlerts(data) : []), [data]);
  const admissionTrend = useMemo(
    () => data?.charts.studentGrowth ?? [],
    [data],
  );
  const systemInfo = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Academic Year", value: data.activeAcademicYear ?? "—", tone: "default" as const },
      { label: "Total Subjects", value: String(data.academics.subjects), tone: "default" as const },
      { label: "Net Income", value: money(data.finance.netIncome), tone: "default" as const },
      { label: "Fee Collection (Month)", value: money(data.fees.collectedThisMonth), tone: "default" as const },
      { label: "Database Status", value: "Connected", tone: "success" as const },
      { label: "Server Status", value: "Online", tone: "success" as const },
    ];
  }, [data]);

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading dashboard…
      </div>
    );
  }

  if (!data || !attendanceBreakdown || !feeCollection || !incomeVsExpense) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>{loadError ? "Could not reach the dashboard API." : "Dashboard data unavailable."}</p>
        {loadError ? (
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Attendance Overview (Today)">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative w-full max-w-[220px]">
              <AttendanceDonut segments={attendanceBreakdown.segments} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">
                  {data.attendanceToday.percentage}%
                </span>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel
          title="Upcoming Exams"
          action="View All"
          onAction={() => router.push("/examinations")}
        >
          {upcomingExams.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No upcoming exams scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingExams.map((e) => (
                <li
                  key={e.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-secondary/50"
                  onClick={() => router.push("/examinations")}
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
          )}
        </Panel>

        <Panel
          title="Recent Activities"
          action="View All"
          onAction={() => toast("Activity log — coming soon", "info")}
        >
          <ul className="space-y-4">
            {recentActivities.length > 0 ? (
              recentActivities.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="text-foreground">{a.text}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">No recent activity.</li>
            )}
          </ul>
        </Panel>

        <Panel
          title="Alerts & Notifications"
          action="View All"
          onAction={() => toast("Notifications — coming soon", "info")}
        >
          <ul className="space-y-3">
            {alerts.map((a, i) => {
              const Icon = ALERT_ICONS[a.icon];
              return (
                <li key={`${a.icon}-${i}`} className="flex items-start gap-3 text-sm">
                  <Icon
                    className={cn("mt-0.5 h-4 w-4 shrink-0", ALERT_TONE[a.tone])}
                  />
                  <span className="text-foreground">{a.text}</span>
                </li>
              );
            })}
          </ul>
        </Panel>

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Panel title="Student Admission Trend" className="xl:col-span-2">
          <AdmissionAreaChart data={admissionTrend} />
        </Panel>

        <Panel
          title="Recent Payments"
          action="View All"
          onAction={() => router.push("/finance/history")}
        >
          <ul className="space-y-3">
            {data.recentPayments.slice(0, 5).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.student}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.receiptNumber} · {p.className ?? "—"}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-emerald-600">
                  {money(p.amount)}
                </span>
              </li>
            ))}
            {data.recentPayments.length === 0 && (
              <li className="text-sm text-muted-foreground">No payments yet.</li>
            )}
          </ul>
        </Panel>

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
