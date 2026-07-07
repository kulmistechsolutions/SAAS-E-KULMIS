import type { ParentAdminSummary, ParentDashboardSummary } from "@/lib/students/store";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  GraduationCap,
  Users,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_CARDS: {
  key: keyof ParentAdminSummary;
  label: string;
  icon: LucideIcon;
  chip: string;
}[] = [
  { key: "totalParents", label: "Total Parents", icon: Users, chip: "bg-violet-500/15 text-violet-600" },
  { key: "activeParents", label: "Active Parents", icon: UserCheck, chip: "bg-emerald-500/15 text-emerald-600" },
  { key: "inactiveParents", label: "Inactive", icon: Users, chip: "bg-slate-500/15 text-slate-500" },
  { key: "totalChildren", label: "Linked Children", icon: GraduationCap, chip: "bg-sky-500/15 text-sky-600" },
  { key: "multiChildFamilies", label: "Multi-Child Families", icon: Users, chip: "bg-indigo-500/15 text-indigo-600" },
  { key: "registeredThisMonth", label: "New This Month", icon: UserCheck, chip: "bg-amber-500/15 text-amber-600" },
];

export function AdminSummaryCards({ summary }: { summary: ParentAdminSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {ADMIN_CARDS.map((c) => (
        <div key={c.key} className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", c.chip)}>
              <c.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="text-2xl font-bold tabular-nums">{summary[c.key]}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

const DASH_CARDS: {
  key: keyof ParentDashboardSummary;
  label: string;
  icon: LucideIcon;
  chip: string;
  format?: (v: number | string) => string;
}[] = [
  { key: "totalChildren", label: "Total Children", icon: Users, chip: "bg-violet-500/15 text-violet-600" },
  { key: "activeStudents", label: "Active Students", icon: UserCheck, chip: "bg-emerald-500/15 text-emerald-600" },
  { key: "outstandingFees", label: "Outstanding Fees", icon: DollarSign, chip: "bg-rose-500/15 text-rose-600", format: (v) => `$${Number(v).toLocaleString()}` },
  { key: "totalFeesPaid", label: "Total Fees Paid", icon: DollarSign, chip: "bg-teal-500/15 text-teal-600", format: (v) => `$${Number(v).toLocaleString()}` },
  { key: "upcomingExams", label: "Upcoming Exams", icon: BookOpen, chip: "bg-sky-500/15 text-sky-600" },
  { key: "activeQuizzes", label: "Active Quizzes", icon: ClipboardList, chip: "bg-indigo-500/15 text-indigo-600" },
  { key: "attendancePercentage", label: "Attendance %", icon: CalendarCheck, chip: "bg-amber-500/15 text-amber-600", format: (v) => `${v}%` },
  { key: "latestGrade", label: "Latest Result", icon: GraduationCap, chip: "bg-emerald-500/15 text-emerald-600" },
];

export function ParentDashboardCards({ summary }: { summary: ParentDashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {DASH_CARDS.map((c) => {
        const raw = summary[c.key];
        const display = c.format ? c.format(raw) : String(raw);
        return (
          <div key={c.key} className="rounded-xl border bg-card p-4 shadow-sm">
            <span className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-lg", c.chip)}>
              <c.icon className="h-4 w-4" />
            </span>
            <p className="text-xl font-bold tabular-nums">{display}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
}
