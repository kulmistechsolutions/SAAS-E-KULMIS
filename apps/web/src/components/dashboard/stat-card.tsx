import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTheme =
  | "violet"
  | "emerald"
  | "amber"
  | "sky"
  | "rose"
  | "teal";

const THEMES: Record<
  StatTheme,
  { card: string; icon: string; value: string; hint: string }
> = {
  violet: {
    card: "from-violet-50 to-white border-violet-100 dark:from-violet-500/10 dark:to-transparent dark:border-violet-500/20",
    icon: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    value: "text-violet-700 dark:text-violet-300",
    hint: "text-violet-600/80 dark:text-violet-400/80",
  },
  emerald: {
    card: "from-emerald-50 to-white border-emerald-100 dark:from-emerald-500/10 dark:to-transparent dark:border-emerald-500/20",
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
    hint: "text-emerald-600/80 dark:text-emerald-400/80",
  },
  amber: {
    card: "from-amber-50 to-white border-amber-100 dark:from-amber-500/10 dark:to-transparent dark:border-amber-500/20",
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-300",
    hint: "text-amber-600/80 dark:text-amber-400/80",
  },
  sky: {
    card: "from-sky-50 to-white border-sky-100 dark:from-sky-500/10 dark:to-transparent dark:border-sky-500/20",
    icon: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    value: "text-sky-700 dark:text-sky-300",
    hint: "text-sky-600/80 dark:text-sky-400/80",
  },
  rose: {
    card: "from-rose-50 to-white border-rose-100 dark:from-rose-500/10 dark:to-transparent dark:border-rose-500/20",
    icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    value: "text-rose-700 dark:text-rose-300",
    hint: "text-rose-600/80 dark:text-rose-400/80",
  },
  teal: {
    card: "from-teal-50 to-white border-teal-100 dark:from-teal-500/10 dark:to-transparent dark:border-teal-500/20",
    icon: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    value: "text-teal-700 dark:text-teal-300",
    hint: "text-teal-600/80 dark:text-teal-400/80",
  },
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  theme: StatTheme;
  hint?: string;
  hintTone?: "up" | "muted";
}

export function StatCard({
  label,
  value,
  icon: Icon,
  theme,
  hint,
  hintTone = "muted",
}: StatCardProps) {
  const t = THEMES[theme];
  return (
    <div
      className={cn(
        "group rounded-2xl border bg-gradient-to-br p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
        t.card,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {label}
          </p>
          <p className={cn("mt-2 text-3xl font-bold tabular-nums", t.value)}>
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
            t.icon,
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
      </div>
      {hint && (
        <p
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-xs font-medium",
            hintTone === "up" ? t.hint : "text-muted-foreground",
          )}
        >
          {hintTone === "up" && <TrendingUp className="h-3.5 w-3.5" />}
          {hint}
        </p>
      )}
    </div>
  );
}
