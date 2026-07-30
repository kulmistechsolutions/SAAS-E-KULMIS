import { useT, type TranslationKey } from "@/lib/i18n/provider";
import type { LucideIcon } from "lucide-react";
import {
  GraduationCap,
  User,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentSummary } from "@/lib/students/store";

const CARDS: {
  key: keyof StudentSummary;
  label: TranslationKey;
  icon: LucideIcon;
  chip: string;
  value: string;
}[] = [
  { key: "total", label: "studentsSummaryCards.totalStudents", icon: Users, chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400", value: "text-foreground" },
  { key: "active", label: "studentsSummaryCards.active", icon: UserCheck, chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", value: "text-foreground" },
  { key: "inactive", label: "studentsSummaryCards.inactive", icon: UserX, chip: "bg-slate-500/15 text-slate-500", value: "text-foreground" },
  { key: "graduated", label: "studentsSummaryCards.graduated", icon: GraduationCap, chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400", value: "text-foreground" },
  { key: "male", label: "studentsSummaryCards.male", icon: User, chip: "bg-blue-500/15 text-blue-600 dark:text-blue-400", value: "text-foreground" },
  { key: "female", label: "studentsSummaryCards.female", icon: User, chip: "bg-pink-500/15 text-pink-600 dark:text-pink-400", value: "text-foreground" },
  { key: "newThisMonth", label: "studentsSummaryCards.newThisMonth", icon: UserPlus, chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400", value: "text-foreground" },
];

export function SummaryCards({ summary }: { summary: StudentSummary }) {
  const t = useT();
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
            <span className={cn("text-2xl font-bold tabular-nums", c.value)}>
              {summary[c.key].toLocaleString()}
            </span>
          </div>
          <p className="mt-2 truncate text-xs font-medium text-muted-foreground">
            {t(c.label)}
          </p>
        </div>
      ))}
    </div>
  );
}
