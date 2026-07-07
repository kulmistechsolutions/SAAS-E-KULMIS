import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileEdit,
  PlayCircle,
  Star,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizDashboardSummary } from "@/lib/quiz/types";

const CARDS: {
  key: keyof QuizDashboardSummary;
  label: string;
  icon: LucideIcon;
  chip: string;
  value: string;
  format?: (v: number) => string;
}[] = [
  { key: "totalQuizzes", label: "Total Quizzes", icon: ClipboardList, chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/15", value: "text-blue-600" },
  { key: "activeQuizzes", label: "Active Quizzes", icon: PlayCircle, chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15", value: "text-emerald-600" },
  { key: "draftQuizzes", label: "Draft Quizzes", icon: FileEdit, chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/15", value: "text-slate-600" },
  { key: "scheduledQuizzes", label: "Scheduled", icon: Clock, chip: "bg-sky-100 text-sky-600 dark:bg-sky-500/15", value: "text-sky-600" },
  { key: "expiredQuizzes", label: "Expired", icon: Timer, chip: "bg-orange-100 text-orange-600 dark:bg-orange-500/15", value: "text-orange-600" },
  { key: "completedQuizzes", label: "Completed", icon: CheckCircle2, chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15", value: "text-violet-600" },
  { key: "totalAttempts", label: "Student Attempts", icon: Users, chip: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15", value: "text-indigo-600" },
  { key: "averageScore", label: "Average Score", icon: Star, chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15", value: "text-amber-600", format: (v) => `${v}%` },
  { key: "pendingReviews", label: "Pending Reviews", icon: FileEdit, chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15", value: "text-rose-600" },
];

export function QuizSummaryCards({ summary }: { summary: QuizDashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((c) => (
        <div key={c.key} className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md">
          <div className="flex items-center gap-3">
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", c.chip)}>
              <c.icon className="h-5 w-5" />
            </span>
            <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
          </div>
          <p className={cn("mt-3 text-2xl font-bold tabular-nums", c.value)}>
            {c.format ? c.format(summary[c.key] as number) : (summary[c.key] as number).toLocaleString()}
          </p>
          <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View details <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
