import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip, e.g. "bg-blue-500/10 text-blue-600". */
  accent: string;
  hint?: string;
}

export function StatCard({ label, value, icon: Icon, accent, hint }: StatCardProps) {
  return (
    <div className="group rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
            accent,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
