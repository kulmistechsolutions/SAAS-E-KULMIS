import { useT, type TranslationKey } from "@/lib/i18n/provider";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Clock, UserCheck, UserX, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeacherSummary } from "@/lib/teachers/store";
import { shiftName, useShifts } from "@/lib/teachers/shifts";

const FIXED_CARDS: {
  key: "total" | "active" | "inactive" | "assignedThisYear" | "withoutAssignments";
  label: TranslationKey;
  icon: LucideIcon;
  chip: string;
}[] = [
  { key: "total", label: "teachersSummaryCards.totalTeachers", icon: Users, chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { key: "active", label: "teachersSummaryCards.active", icon: UserCheck, chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { key: "inactive", label: "teachersSummaryCards.inactive", icon: UserX, chip: "bg-slate-500/15 text-slate-500" },
  { key: "assignedThisYear", label: "teachersSummaryCards.assignedThisYear", icon: BookOpen, chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  { key: "withoutAssignments", label: "teachersSummaryCards.withoutAssignments", icon: UserX, chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
];

const SHIFT_CHIPS = [
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  "bg-lime-500/15 text-lime-600 dark:text-lime-400",
];

export function SummaryCards({ summary }: { summary: TeacherSummary }) {
  const t = useT();
  useShifts(); // subscribe so shift-name labels below update once loaded
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {FIXED_CARDS.map((c) => (
        <Card
          key={c.key}
          icon={c.icon}
          chip={c.chip}
          value={summary[c.key]}
          label={t(c.label)}
        />
      ))}
      {summary.byShift.map((s, i) => (
        <Card
          key={s.id}
          icon={Clock}
          chip={SHIFT_CHIPS[i % SHIFT_CHIPS.length]!}
          value={s.count}
          label={shiftName(s.id)}
        />
      ))}
    </div>
  );
}

function Card({
  icon: Icon,
  chip,
  value,
  label,
}: {
  icon: LucideIcon;
  chip: string;
  value: number;
  label: string;
}) {
  return (
    <div className="group rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
            chip,
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {value.toLocaleString()}
        </span>
      </div>
      <p className="mt-2 truncate text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
