import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  GraduationCap,
  UserX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromotionDashboardSummary } from "@/lib/promotions/types";
import { shortDate } from "@/lib/promotions/format";

interface CardDef {
  key: keyof PromotionDashboardSummary;
  label: string;
  icon: LucideIcon;
  chip: string;
  isDate?: boolean;
}

const CARDS: CardDef[] = [
  { key: "currentAcademicYear", label: "Current Academic Year", icon: CalendarCheck, chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { key: "eligibleForPromotion", label: "Eligible for Promotion", icon: Users, chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { key: "totalPromoted", label: "Promoted", icon: CheckCircle2, chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  { key: "totalGraduated", label: "Graduated", icon: GraduationCap, chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { key: "totalInactive", label: "Inactive Students", icon: UserX, chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  { key: "pendingPromotions", label: "Pending Promotions", icon: Clock, chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { key: "lastPromotionDate", label: "Last Promotion", icon: CalendarClock, chip: "bg-teal-500/15 text-teal-600 dark:text-teal-400", isDate: true },
];

export function PromotionSummaryCards({
  summary,
}: {
  summary: PromotionDashboardSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {CARDS.map((c) => {
        const raw = summary[c.key];
        const value = c.isDate
          ? shortDate(raw as string | null)
          : typeof raw === "number"
            ? raw.toLocaleString()
            : raw || "—";
        return (
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
              <span className="text-lg font-bold tabular-nums text-foreground">
                {value}
              </span>
            </div>
            <p className="mt-2 truncate text-xs font-medium text-muted-foreground">
              {c.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
