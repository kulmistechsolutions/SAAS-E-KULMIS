"use client";


import { useT, type TranslationKey } from "@/lib/i18n/provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Home,
  Lock,
  Monitor,
  PenLine,
  Plus,
  UploadCloud,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonitoringRow } from "@/lib/examinations/types";
import { ExamStatusBadge } from "./exam-status-badge";

const SUB_LOOK: Record<string, { icon: LucideIcon; cls: string; label: string }> = {
  PENDING: { icon: Clock, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400", label: "Pending" },
  SUBMITTED: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", label: "Submitted" },
  LOCKED: { icon: Lock, cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400", label: "Locked" },
};

/** A submission status as a small pill with its icon. */
export function SubmissionPill({ status }: { status: string }) {
  const look = SUB_LOOK[status] ?? SUB_LOOK.PENDING!;
  const Icon = look.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", look.cls)}>
      <Icon className="h-3.5 w-3.5" /> {look.label}
    </span>
  );
}

export function MonitoringTable({ rows }: { rows: MonitoringRow[] }) {
  const t = useT();
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Monitor className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">{t("examinationsWidgets.examMonitoring")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("examinationsWidgets.teacherSubmissionStatusByExamClass")}
            </p>
          </div>
        </div>
        <Link href="/examinations/monitoring" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
          View all <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-xs font-semibold text-foreground/80">
            <tr>
              <th className="px-4 py-2.5 text-start">{t("examinationsWidgets.exam")}</th>
              <th className="px-4 py-2.5 text-start">{t("examinationsWidgets.class")}</th>
              <th className="px-4 py-2.5 text-start">{t("examinationsWidgets.section")}</th>
              <th className="px-4 py-2.5 text-start">{t("examinationsWidgets.subject")}</th>
              <th className="px-4 py-2.5 text-start">{t("examinationsWidgets.teacher")}</th>
              <th className="px-4 py-2.5 text-start">{t("examinationsWidgets.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.examId}-${r.subject}-${i}`} className="border-t transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5 font-semibold">{r.examName}</td>
                <td className="px-4 py-2.5">{r.className}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.section || "—"}</td>
                <td className="px-4 py-2.5">{r.subject}</td>
                <td className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.teacherName}</td>
                <td className="px-4 py-2.5">
                  <SubmissionPill status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {t("examinationsWidgets.noTeacherAssessmentsToMonitor")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const NAV: { label: TranslationKey | string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/examinations", icon: Home },
  { label: "examinationsWidgets.createExam", href: "/examinations/create", icon: Plus },
  { label: "examinationsWidgets.enterMarks", href: "/examinations/marks", icon: PenLine },
  { label: "examinationsWidgets.examGroups", href: "/examinations/groups", icon: Users },
  { label: "Timetable & Rooms", href: "/examinations/timetable", icon: CalendarClock },
  { label: "examinationsWidgets.publishResults", href: "/examinations/results", icon: UploadCloud },
  { label: "examinationsWidgets.monitoring", href: "/examinations/monitoring", icon: BarChart3 },
  { label: "examinationsWidgets.reports", href: "/examinations/reports", icon: FileText },
];

/** The exam module's own navigation, as one bar of pills. */
export function ExamNavBar() {
  const t = useT();
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-2xl border bg-card/90 p-1.5 shadow-sm backdrop-blur scrollbar-slim">
      {NAV.map((n) => {
        const on = n.href === "/examinations" ? path === "/examinations" : path?.startsWith(n.href);
        const label = n.label.includes(".") ? t(n.label as TranslationKey) : n.label;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition",
              on
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25"
                : "text-foreground/80 hover:bg-muted",
            )}
          >
            <n.icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Kept for pages that still show the old tile grid; the overview uses ExamNavBar. */
export function ExamQuickActions() {
  return <ExamNavBar />;
}

export function RecentExamsList({
  exams,
}: {
  exams: { id: string; name: string; className: string; section: string; status: string; term: string }[];
}) {
  const t = useT();
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4 text-primary" />
          {t("examinationsWidgets.recentExaminations")}
        </h2>
        <Link href="/examinations/manage" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          View all <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
      <div className="divide-y">
        {exams.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No examinations yet.</p>
        )}
        {exams.map((e) => (
          <Link
            key={e.id}
            href={`/examinations/marks?exam=${e.id}`}
            className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{e.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {e.className}{e.section && e.section !== "—" ? ` — ${e.section}` : ""} · {e.term}
              </p>
            </div>
            <ExamStatusBadge status={e.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
