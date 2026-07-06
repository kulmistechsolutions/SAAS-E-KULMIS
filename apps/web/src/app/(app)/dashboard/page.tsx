"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  GraduationCap,
  Layers,
  Receipt,
  School,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  UserX,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/dashboard/stat-card";
import { BarChart, GroupedBarChart } from "@/components/dashboard/bar-chart";
import { Card, CardContent } from "@/components/ui/card";

interface AdminDashboard {
  students: {
    total: number;
    active: number;
    inactive: number;
    graduated: number;
    newThisMonth: number;
  };
  teachers: { total: number; morning: number; afternoon: number };
  parents: { total: number };
  academics: { classes: number; sections: number; subjects: number };
  attendanceToday: {
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
  };
  fees: {
    totalOutstanding: number;
    outstandingThisMonth: number;
    collectedToday: number;
    collectedThisMonth: number;
    partialPayments: number;
    advancePayments: number;
  };
  finance: {
    totalIncome: number;
    totalExpenses: number;
    totalSalaries: number;
    netIncome: number;
  };
  activeAcademicYear: string | null;
  charts: {
    studentGrowth: { label: string; value: number }[];
    feeCollection: { label: string; value: number }[];
    incomeVsExpense: { label: string; income: number; expense: number }[];
  };
  recentPayments: {
    id: string;
    receiptNumber: string;
    student: string;
    className: string | null;
    amount: number;
    type: string;
    paidAt: string;
  }[];
  recentActivities: {
    id: string;
    module: string;
    action: string;
    username: string | null;
    createdAt: string;
  }[];
}

const fmt = (n: number) => n.toLocaleString();

const QUICK_ACTIONS = [
  { label: "Add Student", href: "/students", icon: UserPlus },
  { label: "Collect Fees", href: "/finance", icon: DollarSign },
  { label: "Register Teacher", href: "/teachers", icon: GraduationCap },
  { label: "View Reports", href: "/finance", icon: ClipboardList },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-fade-up">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api<AdminDashboard>("/dashboard/admin"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading dashboard…
      </div>
    );
  }

  const alerts: string[] = [];
  if (data.fees.totalOutstanding > 0)
    alerts.push(
      `${fmt(data.fees.totalOutstanding)} in outstanding fees across the school`,
    );
  if (data.attendanceToday.total === 0)
    alerts.push("Attendance has not been taken today");
  if (data.students.graduated > 0)
    alerts.push(`${data.students.graduated} graduated students on record`);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.username} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Academic Year:{" "}
            <span className="font-medium text-foreground">
              {data.activeAcademicYear ?? "Not set"}
            </span>
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <a.icon className="h-4 w-4" />
            {a.label}
          </Link>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a}
            </div>
          ))}
        </div>
      )}

      <Section title="Students">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total" value={fmt(data.students.total)} icon={Users} accent="bg-blue-500/10 text-blue-600" />
          <StatCard label="Active" value={fmt(data.students.active)} icon={Users} accent="bg-emerald-500/10 text-emerald-600" />
          <StatCard label="Inactive" value={fmt(data.students.inactive)} icon={UserX} accent="bg-slate-500/10 text-slate-500" />
          <StatCard label="Graduated" value={fmt(data.students.graduated)} icon={GraduationCap} accent="bg-violet-500/10 text-violet-600" />
          <StatCard label="New / Month" value={fmt(data.students.newThisMonth)} icon={UserPlus} accent="bg-sky-500/10 text-sky-600" />
        </div>
      </Section>

      <Section title="People & Academics">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Teachers" value={fmt(data.teachers.total)} icon={GraduationCap} accent="bg-indigo-500/10 text-indigo-600" />
          <StatCard label="Morning" value={fmt(data.teachers.morning)} icon={CalendarCheck} accent="bg-amber-500/10 text-amber-600" />
          <StatCard label="Afternoon" value={fmt(data.teachers.afternoon)} icon={CalendarCheck} accent="bg-orange-500/10 text-orange-600" />
          <StatCard label="Parents" value={fmt(data.parents.total)} icon={Users} accent="bg-teal-500/10 text-teal-600" />
          <StatCard label="Classes" value={fmt(data.academics.classes)} icon={School} accent="bg-cyan-500/10 text-cyan-600" />
          <StatCard label="Subjects" value={fmt(data.academics.subjects)} icon={BookOpen} accent="bg-fuchsia-500/10 text-fuchsia-600" />
        </div>
      </Section>

      <Section title="Attendance — Today">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Present" value={fmt(data.attendanceToday.present)} icon={CalendarCheck} accent="bg-emerald-500/10 text-emerald-600" />
          <StatCard label="Absent" value={fmt(data.attendanceToday.absent)} icon={UserX} accent="bg-rose-500/10 text-rose-600" />
          <StatCard label="Late" value={fmt(data.attendanceToday.late)} icon={ClipboardList} accent="bg-amber-500/10 text-amber-600" />
          <StatCard label="Attendance %" value={`${data.attendanceToday.percentage}%`} icon={TrendingUp} accent="bg-blue-500/10 text-blue-600" />
        </div>
      </Section>

      <Section title="Fees & Finance">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          <StatCard label="Outstanding" value={fmt(data.fees.totalOutstanding)} icon={Wallet} accent="bg-rose-500/10 text-rose-600" />
          <StatCard label="Collected / Mo" value={fmt(data.fees.collectedThisMonth)} icon={Receipt} accent="bg-emerald-500/10 text-emerald-600" />
          <StatCard label="Income" value={fmt(data.finance.totalIncome)} icon={TrendingUp} accent="bg-green-500/10 text-green-600" />
          <StatCard label="Expenses" value={fmt(data.finance.totalExpenses)} icon={TrendingDown} accent="bg-rose-500/10 text-rose-600" />
          <StatCard label="Salaries" value={fmt(data.finance.totalSalaries)} icon={DollarSign} accent="bg-amber-500/10 text-amber-600" />
          <StatCard label="Net Income" value={fmt(data.finance.netIncome)} icon={Layers} accent="bg-primary/10 text-primary" />
        </div>
      </Section>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="animate-fade-up">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold">Student Growth</h3>
            <BarChart data={data.charts.studentGrowth} />
          </CardContent>
        </Card>
        <Card className="animate-fade-up">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold">Fee Collection</h3>
            <BarChart data={data.charts.feeCollection} color="rgb(16 185 129)" />
          </CardContent>
        </Card>
        <Card className="animate-fade-up">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold">Income vs Expense</h3>
            <GroupedBarChart data={data.charts.incomeVsExpense} />
          </CardContent>
        </Card>
      </div>

      {/* Recent payments + activities */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden animate-fade-up">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold">Recent Payments</h3>
            {data.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Student</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPayments.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2">{p.student}</td>
                      <td className="py-2 font-medium tabular-nums">
                        {fmt(p.amount)}
                      </td>
                      <td className="py-2">
                        <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                          {p.type}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {p.receiptNumber}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-up">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold">Recent Activity</h3>
            {data.recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.recentActivities.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <span className="font-medium">{a.action}</span>{" "}
                      <span className="text-muted-foreground">
                        · {a.module} · {a.username ?? "system"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
