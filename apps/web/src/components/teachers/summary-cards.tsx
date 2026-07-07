import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Clock,
  Sun,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeacherSummary } from "@/lib/teachers/store";

const CARDS: {
  key: keyof TeacherSummary;
  label: string;
  icon: LucideIcon;
  chip: string;
}[] = [
  { key: "total", label: "Total Teachers", icon: Users, chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { key: "active", label: "Active", icon: UserCheck, chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { key: "inactive", label: "Inactive", icon: UserX, chip: "bg-slate-500/15 text-slate-500" },
  { key: "morning", label: "Morning Shift", icon: Sun, chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { key: "afternoon", label: "Afternoon Shift", icon: Clock, chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { key: "assignedThisYear", label: "Assigned This Year", icon: BookOpen, chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  { key: "withoutAssignments", label: "Without Assignments", icon: UserX, chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
];

export function SummaryCards({ summary }: { summary: TeacherSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="group rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
                c.chip,
              )}
            >
              <c.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {summary[c.key].toLocaleString()}
            </span>
          </div>
          <p className="mt-2 truncate text-xs font-medium text-muted-foreground">
            {c.label}
          </p>
        </div>
      ))}
    </div>
  );
}
