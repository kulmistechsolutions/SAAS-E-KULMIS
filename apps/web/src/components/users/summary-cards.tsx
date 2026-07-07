import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Briefcase,
  ClipboardCheck,
  GraduationCap,
  Shield,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UsersDashboardSummary } from "@/lib/users/types";

const CARDS: {
  key: keyof UsersDashboardSummary;
  label: string;
  icon: LucideIcon;
  chip: string;
  value: string;
}[] = [
  { key: "totalUsers", label: "Total Users", icon: Users, chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/15", value: "text-blue-600 dark:text-blue-400" },
  { key: "activeUsers", label: "Active Users", icon: UserCheck, chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15", value: "text-emerald-600 dark:text-emerald-400" },
  { key: "inactiveUsers", label: "Inactive Users", icon: UserX, chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/15", value: "text-slate-600 dark:text-slate-400" },
  { key: "administrators", label: "Administrators", icon: Shield, chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15", value: "text-violet-600 dark:text-violet-400" },
  { key: "teachers", label: "Teachers", icon: GraduationCap, chip: "bg-sky-100 text-sky-600 dark:bg-sky-500/15", value: "text-sky-600 dark:text-sky-400" },
  { key: "parents", label: "Parents", icon: Users, chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
  { key: "financeOfficers", label: "Finance Officers", icon: Briefcase, chip: "bg-green-100 text-green-600 dark:bg-green-500/15", value: "text-green-600 dark:text-green-400" },
  { key: "attendanceOfficers", label: "Attendance Officers", icon: ClipboardCheck, chip: "bg-teal-100 text-teal-600 dark:bg-teal-500/15", value: "text-teal-600 dark:text-teal-400" },
  { key: "examManagers", label: "Exam Managers", icon: ClipboardCheck, chip: "bg-orange-100 text-orange-600 dark:bg-orange-500/15", value: "text-orange-600 dark:text-orange-400" },
  { key: "receptionOfficers", label: "Reception Officers", icon: Briefcase, chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15", value: "text-rose-600 dark:text-rose-400" },
];

export function UsersSummaryCards({ summary }: { summary: UsersDashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((c) => (
        <div key={c.key} className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3">
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", c.chip)}>
              <c.icon className="h-5 w-5" />
            </span>
            <p className="text-xs font-medium leading-tight text-muted-foreground">{c.label}</p>
          </div>
          <p className={cn("mt-3 text-2xl font-bold tabular-nums tracking-tight", c.value)}>
            {summary[c.key].toLocaleString()}
          </p>
          <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View details
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
