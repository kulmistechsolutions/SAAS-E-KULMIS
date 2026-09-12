"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Printer,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT } from "@/lib/i18n/provider";
import { useAuth } from "@/lib/auth";
import { isFullAccessRole } from "@/lib/rbac/routes";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import {
  apiAttendanceOverview,
  type AttendanceOverview,
} from "@/lib/attendance/api";
import { printAttendanceReport } from "@/lib/attendance/report-print";

/**
 * The attendance dashboard.
 *
 * A head teacher opens this at nine in the morning to find out one thing:
 * have the registers been taken, and what do they say. Everything on the page
 * is computed from the attendance rows themselves in a single request, scoped
 * on the server to whatever classes the signed-in user is responsible for.
 *
 * Every figure links to the screen that explains it. A number an administrator
 * cannot act on is a number they learn to ignore.
 */

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
}

const NAV: NavItem[] = [
  { title: "Overview", href: "/attendance", icon: LayoutDashboard },
  { title: "My Classes", href: "/attendance/my-classes", icon: CalendarCheck, roles: ["ATTENDANCE_OFFICER"] },
  { title: "Mark Attendance", href: "/attendance/students", icon: Users },
  { title: "Teacher Attendance", href: "/attendance/teachers", icon: GraduationCap, roles: ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"] },
  { title: "Monitoring", href: "/attendance/monitoring", icon: Eye, roles: ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"] },
  { title: "Officers", href: "/attendance/officers", icon: ShieldCheck, roles: ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"] },
  { title: "Shift Management", href: "/attendance/shifts", icon: Clock },
];

const WINDOWS = [7, 14, 30, 90];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

export default function AttendanceDashboardPage() {
  const t = useT();
  const hydrated = useHydrated();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const nav = NAV.filter(
    (n) => !n.roles || isFullAccessRole(role) || n.roles.includes(role),
  );

  const [date, setDate] = useState(today());
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AttendanceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiAttendanceOverview(date, days));
    } catch (e) {
      // The links stay reachable even when the figures will not load.
      toast(
        e instanceof Error ? e.message : "Could not load attendance figures",
        "error",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date, days]);

  useEffect(() => {
    if (hydrated) void load();
  }, [hydrated, load]);

  const tod = data?.today;
  const marked = tod?.total ?? 0;
  const delta =
    data && data.previousRate !== null ? (tod?.rate ?? 0) - data.previousRate : null;

  const genderData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Male", value: data.gender.male.marked, rate: data.gender.male.rate },
      { name: "Female", value: data.gender.female.marked, rate: data.gender.female.rate },
    ].filter((d) => d.value > 0);
  }, [data]);

  const completionData = useMemo(() => {
    if (!data) return [];
    const completed = data.registers.filter((r) => r.state === "COMPLETED").length;
    const partial = data.registers.filter((r) => r.state === "PARTIAL").length;
    const notStarted = Math.max(
      0,
      data.completion.expected - completed - partial,
    );
    return [
      { name: "Completed", value: completed, fill: "#10b981" },
      { name: "Partial", value: partial, fill: "#f59e0b" },
      { name: "Not started", value: notStarted, fill: "#e2e8f0" },
    ];
  }, [data]);

  function printToday() {
    if (!data || data.registers.length === 0) {
      toast("Nothing has been marked for this date.", "error");
      return;
    }
    printAttendanceReport({
      kind: "DAILY",
      scope: [
        { label: "Date", value: date },
        { label: "Registers", value: `${data.completion.taken} of ${data.completion.expected}` },
      ],
      summary: [
        { label: "Present", value: String(tod?.PRESENT ?? 0) },
        { label: "Absent", value: String(tod?.ABSENT ?? 0) },
        { label: "Late", value: String(tod?.LATE ?? 0) },
        { label: "Rate", value: `${tod?.rate ?? 0}%` },
      ],
      columns: [
        { key: "className", label: "Class" },
        { key: "section", label: "Section" },
        { key: "shift", label: "Shift" },
        { key: "total", label: "Total", align: "end" },
        { key: "present", label: "Present", align: "end" },
        { key: "absent", label: "Absent", align: "end" },
        { key: "late", label: "Late", align: "end" },
        { key: "state", label: "Status" },
      ],
      rows: data.registers.map((r) => ({
        className: r.className,
        section: r.section || "—",
        shift: r.shift || "—",
        total: r.total,
        present: r.present,
        absent: r.absent,
        late: r.late,
        state: r.state === "COMPLETED" ? "Completed" : "Partial",
      })),
    });
  }

  if (!hydrated) return null;

  return (
    <div className="space-y-5">
      {/* ── Heading ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Attendance Dashboard</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("attendance.recordAndMonitorDailyAttendanceFor")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || today())}
              className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Button variant="outline" className="h-9" onClick={() => void load()}>
            <RefreshCw className="me-2 h-4 w-4" /> Refresh
          </Button>
          <Button className="h-9" onClick={printToday}>
            <Printer className="me-2 h-4 w-4" /> Generate Report
          </Button>
        </div>
      </div>

      {/* ── The module's pages ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border bg-card p-2 shadow-sm">
        {nav.map((n) => {
          const active = n.href === "/attendance";
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <n.icon className="h-4 w-4" />
              {n.title}
            </Link>
          );
        })}
      </div>

      {/* ── Six figures for the day ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          href="/attendance/students"
          icon={Users}
          tone="blue"
          label="Total Students"
          value={(tod?.expected ?? 0).toLocaleString()}
          note={`${marked.toLocaleString()} marked today`}
        />
        <Kpi
          href="/attendance/students"
          icon={UserCheck}
          tone="emerald"
          label="Present Today"
          value={(tod?.PRESENT ?? 0).toLocaleString()}
          note={`${pct(tod?.PRESENT ?? 0, marked)}% of marked`}
        />
        <Kpi
          href="/attendance/students"
          icon={UserMinus}
          tone="rose"
          label="Absent Today"
          value={(tod?.ABSENT ?? 0).toLocaleString()}
          note={`${pct(tod?.ABSENT ?? 0, marked)}% of marked`}
        />
        <Kpi
          href="/attendance/students"
          icon={Clock}
          tone="amber"
          label="Late Today"
          value={(tod?.LATE ?? 0).toLocaleString()}
          note={`${pct(tod?.LATE ?? 0, marked)}% of marked`}
        />
        <Kpi
          href="/attendance/students"
          icon={FileText}
          tone="violet"
          label="Excused"
          value={(tod?.EXCUSED ?? 0).toLocaleString()}
          note={`${pct(tod?.EXCUSED ?? 0, marked)}% of marked`}
        />
        <Kpi
          href="/attendance/monitoring"
          icon={CheckCircle2}
          tone="indigo"
          label="Attendance Rate"
          value={`${tod?.rate ?? 0}%`}
          note={
            delta === null
              ? loading
                ? "Loading…"
                : "No figure for yesterday"
              : `${delta >= 0 ? "+" : ""}${delta}% vs yesterday`
          }
          trend={delta === null ? undefined : delta >= 0 ? "up" : "down"}
        />
      </div>

      {/* ── Three charts ───────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title={`Attendance Trend (Last ${days} Days)`}
          action={
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-7 rounded-md border bg-background px-2 text-xs outline-none"
            >
              {WINDOWS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          }
        >
          {(data?.trend.length ?? 0) === 0 ? (
            <Empty loading={loading} text="Nothing marked in this window." />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={data!.trend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(d: string) => d.slice(5)}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "Rate"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  /* A day nobody marked has no rate to plot; the line breaks
                     rather than dropping to the floor, which would read as a
                     catastrophe instead of a holiday. */
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Attendance by Gender">
          {genderData.length === 0 ? (
            <Empty loading={loading} text="Nothing marked today." />
          ) : (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {genderData.map((d) => (
                      <Cell key={d.name} fill={d.name === "Male" ? "#3b82f6" : "#ec4899"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, n: string) => [`${v} marked`, n]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-3 text-sm">
                {genderData.map((d) => (
                  <li key={d.name}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: d.name === "Male" ? "#3b82f6" : "#ec4899" }}
                      />
                      <span className="font-medium">{d.name}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {d.value.toLocaleString()} marked · {d.rate}% present
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Attendance by Class">
          {(data?.byClass.length ?? 0) === 0 ? (
            <Empty loading={loading} text="No class has been marked." />
          ) : (
            <div className="max-h-[210px] space-y-2 overflow-auto pe-1">
              {data!.byClass.map((c) => (
                <div key={c.classId} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 truncate">{c.className}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full ${
                        c.rate >= 90 ? "bg-emerald-500" : c.rate >= 75 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${c.rate}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-end font-medium tabular-nums">
                    {c.rate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Two tables ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Today's Attendance Status"
          action={
            <Link href="/attendance/monitoring" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          {(data?.registers.length ?? 0) === 0 ? (
            <Empty loading={loading} text="No register has been taken today." />
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-y bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-start font-medium">Class</th>
                    <th className="px-3 py-2 text-start font-medium">Section</th>
                    <th className="px-3 py-2 text-start font-medium">Shift</th>
                    <th className="px-3 py-2 text-end font-medium">Present</th>
                    <th className="px-3 py-2 text-end font-medium">Absent</th>
                    <th className="px-4 py-2 text-start font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.registers.slice(0, 8).map((r, i) => (
                    <tr key={`${r.classId}-${r.section}-${r.shift}-${i}`} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{r.className}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.section || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.shift || "—"}</td>
                      <td className="px-3 py-2 text-end tabular-nums text-emerald-600">{r.present}</td>
                      <td className="px-3 py-2 text-end tabular-nums text-rose-600">{r.absent}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            r.state === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                          }`}
                        >
                          {r.state === "COMPLETED" ? "Completed" : `${r.marked}/${r.total}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title={`Most Absent Students (Last ${days} Days)`}
          action={
            <Link href="/attendance/students" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          {(data?.mostAbsent.length ?? 0) === 0 ? (
            <Empty loading={loading} text="Nobody has been absent." />
          ) : (
            <ul className="space-y-2">
              {data!.mostAbsent.slice(0, 5).map((s, i) => (
                <li key={s.studentId} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.className} · {s.code}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                    {s.absences} absent
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Actions and completion ─────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Quick Actions">
          <div className="grid grid-cols-2 gap-2">
            {nav
              .filter((n) => n.href !== "/attendance")
              .slice(0, 4)
              .map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="flex flex-col gap-1.5 rounded-xl border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-secondary/50"
                >
                  <n.icon className="h-5 w-5 text-primary" />
                  <span className="font-medium leading-tight">{n.title}</span>
                </Link>
              ))}
          </div>
        </Panel>

        <Panel title="Attendance Completion" className="lg:col-span-2">
          {!data || data.completion.expected === 0 ? (
            <Empty loading={loading} text="No classes to take." />
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <div className="relative">
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie
                      data={completionData}
                      dataKey="value"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {completionData.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{data.completion.percent}%</span>
                  <span className="text-[11px] text-muted-foreground">taken</span>
                </div>
              </div>
              <ul className="space-y-2.5 text-sm">
                {completionData.map((d) => (
                  <li key={d.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
                    <span className="w-24">{d.name}</span>
                    <span className="font-semibold tabular-nums">{d.value}</span>
                  </li>
                ))}
                <li className="border-t pt-2 text-xs text-muted-foreground">
                  {data.completion.taken} of {data.completion.expected} classes
                </li>
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ loading, text }: { loading: boolean; text: string }) {
  return (
    <p className="py-12 text-center text-sm text-muted-foreground">
      {loading ? "Loading…" : text}
    </p>
  );
}

const TONES: Record<string, { chip: string; value: string }> = {
  blue: { chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300", value: "text-blue-600 dark:text-blue-400" },
  emerald: { chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300", value: "text-emerald-600 dark:text-emerald-400" },
  rose: { chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300", value: "text-rose-600 dark:text-rose-400" },
  amber: { chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300", value: "text-amber-600 dark:text-amber-400" },
  violet: { chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300", value: "text-violet-600 dark:text-violet-400" },
  indigo: { chip: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300", value: "text-indigo-600 dark:text-indigo-400" },
};

function Kpi({
  href,
  icon: Icon,
  tone,
  label,
  value,
  note,
  trend,
}: {
  href: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  note: string;
  trend?: "up" | "down";
}) {
  const c = TONES[tone];
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-3.5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.chip}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-2.5 text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${c.value}`}>{value}</p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
        {trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-600" />}
        {trend === "down" && <TrendingDown className="h-3 w-3 text-rose-600" />}
        {note}
      </p>
    </Link>
  );
}
