import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lock,
  PieChart,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExamDashboardSummary } from "@/lib/examinations/types";

const CARDS: {
  key: keyof ExamDashboardSummary;
  label: string;
  icon: LucideIcon;
  chip: string;
  value: string;
}[] = [
  {
    key: "totalExams",
    label: "Total Exams",
    icon: FileText,
    chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/15",
    value: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "activeExams",
    label: "Active Exams",
    icon: BookOpen,
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "draftExams",
    label: "Draft Exams",
    icon: ClipboardList,
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/15",
    value: "text-slate-600 dark:text-slate-400",
  },
  {
    key: "lockedExams",
    label: "Locked Exams",
    icon: Lock,
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15",
    value: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "publishedExams",
    label: "Published Exams",
    icon: Send,
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15",
    value: "text-violet-600 dark:text-violet-400",
  },
  {
    key: "pendingSubmissions",
    label: "Pending Teacher Submissions",
    icon: ClipboardList,
    chip: "bg-orange-100 text-orange-600 dark:bg-orange-500/15",
    value: "text-orange-600 dark:text-orange-400",
  },
  {
    key: "completedSubmissions",
    label: "Completed Teacher Submissions",
    icon: CheckCircle2,
    chip: "bg-green-100 text-green-600 dark:bg-green-500/15",
    value: "text-green-600 dark:text-green-400",
  },
  {
    key: "examGroups",
    label: "Exam Groups",
    icon: PieChart,
    chip: "bg-sky-100 text-sky-600 dark:bg-sky-500/15",
    value: "text-sky-600 dark:text-sky-400",
  },
  {
    key: "resultPublications",
    label: "Result Publications",
    icon: Send,
    chip: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15",
    value: "text-indigo-600 dark:text-indigo-400",
  },
];

export function ExamSummaryCards({ summary }: { summary: ExamDashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                c.chip,
              )}
            >
              <c.icon className="h-5 w-5" />
            </span>
            <p className="text-xs font-medium leading-tight text-muted-foreground">
              {c.label}
            </p>
          </div>
          <p
            className={cn(
              "mt-3 text-2xl font-bold tabular-nums tracking-tight",
              c.value,
            )}
          >
            {summary[c.key].toLocaleString()}
          </p>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View details
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
