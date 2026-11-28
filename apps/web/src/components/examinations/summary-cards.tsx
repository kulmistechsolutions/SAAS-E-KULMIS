import Link from "next/link";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  Layers,
  Lock,
  Megaphone,
  Send,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExamDashboardSummary } from "@/lib/examinations/types";

type Card = {
  key: keyof ExamDashboardSummary;
  label: TranslationKey;
  icon: LucideIcon;
  tile: string;
  tint: string;
  value?: string;
  href: string;
};

/** The exam counts: the five states of an exam, then the work around them. */
const TOP: Card[] = [
  { key: "totalExams", label: "examinationsSummaryCards.totalExams", icon: FileText, tile: "bg-blue-500/15 text-blue-600 dark:text-blue-400", tint: "from-blue-500/10", href: "/examinations/manage" },
  { key: "activeExams", label: "examinationsSummaryCards.activeExams", icon: BookOpen, tile: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", tint: "from-emerald-500/10", href: "/examinations/manage" },
  { key: "draftExams", label: "examinationsSummaryCards.draftExams", icon: ClipboardList, tile: "bg-slate-500/15 text-slate-600 dark:text-slate-300", tint: "from-slate-500/10", href: "/examinations/manage" },
  { key: "lockedExams", label: "examinationsSummaryCards.lockedExams", icon: Lock, tile: "bg-amber-500/15 text-amber-600 dark:text-amber-400", tint: "from-amber-500/10", href: "/examinations/manage" },
  { key: "publishedExams", label: "examinationsSummaryCards.publishedExams", icon: Send, tile: "bg-violet-500/15 text-violet-600 dark:text-violet-400", tint: "from-violet-500/10", href: "/examinations/results" },
];

const BOTTOM: Card[] = [
  { key: "pendingSubmissions", label: "examinationsSummaryCards.pendingTeacherSubmissions", icon: Timer, tile: "bg-orange-500/15 text-orange-600 dark:text-orange-400", tint: "from-orange-500/10", value: "text-orange-600 dark:text-orange-400", href: "/examinations/monitoring" },
  { key: "completedSubmissions", label: "examinationsSummaryCards.completedTeacherSubmissions", icon: CheckCircle2, tile: "bg-green-500/15 text-green-600 dark:text-green-400", tint: "from-green-500/10", value: "text-green-600 dark:text-green-400", href: "/examinations/monitoring" },
  { key: "examGroups", label: "examinationsSummaryCards.examGroups", icon: Layers, tile: "bg-sky-500/15 text-sky-600 dark:text-sky-400", tint: "from-sky-500/10", href: "/examinations/groups" },
  { key: "resultPublications", label: "examinationsSummaryCards.resultPublications", icon: Megaphone, tile: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", tint: "from-indigo-500/10", href: "/examinations/results" },
];

function StatCard({ c, value }: { c: Card; value: number }) {
  const t = useT();
  return (
    <Link
      href={c.href}
      className={cn(
        "group flex items-center gap-3.5 rounded-2xl border bg-gradient-to-br to-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        c.tint,
      )}
    >
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", c.tile)}>
        <c.icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight text-muted-foreground">{t(c.label)}</p>
        <p className={cn("mt-1 text-2xl font-bold tabular-nums tracking-tight", c.value)}>
          {value.toLocaleString()}
        </p>
      </div>
    </Link>
  );
}

export function ExamSummaryCards({ summary }: { summary: ExamDashboardSummary }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {TOP.map((c) => <StatCard key={c.key} c={c} value={summary[c.key]} />)}
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {BOTTOM.map((c) => <StatCard key={c.key} c={c} value={summary[c.key]} />)}
      </div>
    </div>
  );
}
