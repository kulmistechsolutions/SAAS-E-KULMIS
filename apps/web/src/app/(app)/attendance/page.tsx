"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { useAuth } from "@/lib/auth";
import { isFullAccessRole } from "@/lib/rbac/routes";
import { useHydrated } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  apiAttendanceOverview,
  type AttendanceOverview,
} from "@/lib/attendance/api";

/**
 * The attendance dashboard.
 *
 * This page used to be six links and nothing else — a menu that told a head
 * teacher nothing about whether today's registers had been taken. The figures
 * below all come from the attendance rows themselves, in one request, scoped
 * on the server to whatever classes the signed-in user is responsible for.
 *
 * Every card and bar is a link into the screen that explains it, because a
 * number an administrator cannot act on is a number they learn to ignore.
 */

interface HubCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  roles?: string[];
}

const SECTIONS: HubCard[] = [
  {
    title: "My Classes",
    description:
      "The registers you have been assigned, and which of them you have still to take today.",
    href: "/attendance/my-classes",
    icon: CalendarCheck,
    color: "from-emerald-500 to-teal-600",
    roles: ["ATTENDANCE_OFFICER"],
  },
  {
    title: "Student Attendance",
    description: "Mark daily attendance by class and section. View reports and history.",
    href: "/attendance/students",
    icon: Users,
    color: "from-blue-500 to-indigo-600",
  },
  {
    title: "Teacher Attendance",
    description: "Mark morning and afternoon shift attendance. Track teacher presence.",
    href: "/attendance/teachers",
    icon: GraduationCap,
    color: "from-violet-500 to-purple-600",
    roles: ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"],
  },
  {
    title: "Attendance Shift Management",
    description:
      "Set up the sessions your school takes attendance for, e.g. Morning and Afternoon.",
    href: "/attendance/shifts",
    icon: Clock,
    color: "from-amber-500 to-orange-600",
  },
  {
    title: "Attendance Monitoring",
    description:
      "See which registers were taken today, by whom, and which are still outstanding.",
    href: "/attendance/monitoring",
    icon: Eye,
    color: "from-sky-500 to-cyan-600",
    roles: ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"],
  },
  {
    title: "Attendance Officers",
    description:
      "Choose which classes, sections and shifts each officer may take attendance for.",
    href: "/attendance/officers",
    icon: ShieldCheck,
    color: "from-rose-500 to-pink-600",
    roles: ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"],
  },
];

const WINDOWS = [7, 14, 30, 90];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceHubPage() {
  const t = useT();
  const hydrated = useHydrated();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const sections = SECTIONS.filter(
    (s) => !s.roles || isFullAccessRole(role) || s.roles.includes(role),
  );

  const [date, setDate] = useState(today());
  const [days, setDays] = useState(14);
  const [data, setData] = useState<AttendanceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiAttendanceOverview(date, days));
    } catch (e) {
      // A dashboard that cannot load is not a reason to lose the links below
      // it, so the page keeps rendering and says what failed.
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

  const trendMax = useMemo(
    () => Math.max(100, ...(data?.trend ?? []).map((p) => p.rate)),
    [data],
  );

  if (!hydrated) return null;

  const tod = data?.today;
  const notMarked = tod ? Math.max(0, tod.expected - tod.total) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("attendance.attendance")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("attendance.recordAndMonitorDailyAttendanceFor")}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              className="mt-1 h-9"
              value={date}
              onChange={(e) => setDate(e.target.value || today())}
            />
          </div>
          <div>
            <Label>Window</Label>
            <Select
              className="mt-1 h-9"
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {WINDOWS.map((d) => (
                <option key={d} value={d}>
                  Last {d} days
                </option>
              ))}
            </Select>
          </div>
          <Button variant="outline" className="h-9" onClick={() => void load()}>
            <RefreshCw className="me-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── The day itself ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          href="/attendance/monitoring"
          icon={CheckCircle2}
          tone="emerald"
          label="Attendance rate"
          value={tod ? `${tod.rate}%` : "—"}
          note={
            tod
              ? `${(tod.PRESENT + tod.LATE).toLocaleString()} of ${tod.total.toLocaleString()} marked`
              : loading
                ? "Loading…"
                : "No figures"
          }
        />
        <Stat
          href="/attendance/students"
          icon={UserMinus}
          tone={tod && tod.ABSENT > 0 ? "rose" : "slate"}
          label="Absent"
          value={tod ? tod.ABSENT.toLocaleString() : "—"}
          note={tod ? `${tod.LATE.toLocaleString()} late · ${tod.EXCUSED.toLocaleString()} excused` : ""}
        />
        <Stat
          href="/attendance/monitoring"
          icon={CalendarCheck}
          tone={data && data.completion.pending > 0 ? "amber" : "emerald"}
          label="Registers taken"
          value={
            data ? `${data.completion.taken}/${data.completion.expected}` : "—"
          }
          note={
            data
              ? data.completion.pending > 0
                ? `${data.completion.pending} still outstanding`
                : "All registers taken"
              : ""
          }
        >
          {data && data.completion.expected > 0 && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${data.completion.percent}%` }}
              />
            </div>
          )}
        </Stat>
        <Stat
          href="/attendance/students"
          icon={AlertTriangle}
          tone={notMarked > 0 ? "amber" : "slate"}
          label="Not marked"
          value={notMarked.toLocaleString()}
          note={
            tod
              ? `${tod.expected.toLocaleString()} children on the roll`
              : ""
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Is the school drifting? ──────────────────────────────── */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="font-semibold">Attendance over the last {days} days</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {/* A day nobody marked is drawn as a gap, not as nought percent —
                the two look identical on a chart and mean opposite things. */}
            Days with no register taken are left blank rather than shown as zero.
          </p>
          {(data?.trend.length ?? 0) === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {loading ? "Loading…" : "Nothing marked in this window."}
            </p>
          ) : (
            <div className="mt-4 flex h-40 items-end gap-1">
              {data!.trend.map((p) => (
                <div
                  key={p.date}
                  className="group relative flex-1"
                  title={`${p.date} · ${p.marked ? `${p.rate}%` : "not taken"}`}
                >
                  <div
                    className={`w-full rounded-t ${
                      p.marked === 0
                        ? "bg-secondary"
                        : p.rate >= 90
                          ? "bg-emerald-500"
                          : p.rate >= 75
                            ? "bg-amber-500"
                            : "bg-rose-500"
                    }`}
                    style={{
                      height: p.marked
                        ? `${Math.max(4, (p.rate / trendMax) * 100)}%`
                        : "4px",
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Who is missing most ──────────────────────────────────── */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Most absent</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Over the last {days} days.
          </p>
          {(data?.mostAbsent.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {loading ? "Loading…" : "Nobody has been absent."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data!.mostAbsent.map((s, i) => (
                <li key={s.studentId} className="flex items-center gap-2 text-sm">
                  <span className="w-4 shrink-0 text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.className} · {s.code}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                    {s.absences}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Which classes are the problem ───────────────────────────── */}
      {(data?.byClass.length ?? 0) > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Attendance by class</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Over the last {days} days. Classes with nothing marked are left out.
          </p>
          <div className="mt-4 space-y-2.5">
            {data!.byClass.map((c) => (
              <div key={c.classId} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate">{c.className}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full ${
                      c.rate >= 90
                        ? "bg-emerald-500"
                        : c.rate >= 75
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                    style={{ width: `${c.rate}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-end font-medium tabular-nums">
                  {c.rate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Where to go next ────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span
              className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} text-white shadow-sm transition-transform group-hover:scale-105`}
            >
              <s.icon className="h-5 w-5" />
            </span>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 flex-1 text-xs text-muted-foreground">
              {s.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

const TONES: Record<string, { chip: string; value: string }> = {
  emerald: {
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    value: "text-rose-600 dark:text-rose-400",
  },
  amber: {
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    value: "text-amber-600 dark:text-amber-400",
  },
  slate: { chip: "bg-secondary text-muted-foreground", value: "text-foreground" },
};

function Stat({
  href,
  icon: Icon,
  tone,
  label,
  value,
  note,
  children,
}: {
  href: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  note: string;
  children?: React.ReactNode;
}) {
  const c = TONES[tone] ?? TONES.slate;
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold tabular-nums ${c.value}`}>
            {value}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${c.chip}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {note && <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p>}
      {children}
    </Link>
  );
}
