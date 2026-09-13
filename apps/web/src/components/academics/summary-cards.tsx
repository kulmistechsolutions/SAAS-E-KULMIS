import Link from "next/link";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Layers,
  Library,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AcademicsDashboardSummary } from "@/lib/academics/types";

/**
 * What the school actually has.
 *
 * This was nine tiles on a five-column grid, so the second row ended four
 * short and the eye had no line to follow. Two of the nine repeated the year
 * picker in the top bar and the table further down, and two more were warnings
 * dressed as counts — a red number with nowhere to click.
 *
 * Four figures, one row, every one of them a link to the list behind it.
 */
interface CardDef {
  key: keyof AcademicsDashboardSummary;
  label: TranslationKey;
  href: string;
  icon: LucideIcon;
  chip: string;
}

const CARDS: CardDef[] = [
  {
    key: "totalClasses",
    label: "academicsSummaryCards.totalClasses",
    href: "/academics/classes",
    icon: Library,
    chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  },
  {
    key: "totalSections",
    label: "academicsSummaryCards.totalSections",
    href: "/academics/sections",
    icon: Layers,
    chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  {
    key: "totalSubjects",
    label: "academicsSummaryCards.totalSubjects",
    href: "/academics/subjects",
    icon: BookOpen,
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    key: "totalStudents",
    label: "academicsSummaryCards.totalStudents",
    href: "/students",
    icon: Users,
    chip: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  },
];

export function AcademicsSummaryCards({
  summary,
}: {
  summary: AcademicsDashboardSummary;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map((c) => {
        const value = summary[c.key];
        return (
          <Link
            key={c.key}
            href={c.href}
            className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                  c.chip,
                )}
              >
                <c.icon className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <p className="mt-4 text-3xl font-bold leading-none tabular-nums">
              {typeof value === "number" ? value.toLocaleString() : value || "—"}
            </p>
            <p className="mt-1.5 truncate text-sm text-muted-foreground">
              {t(c.label)}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * What is still missing, said as a sentence instead of a red number.
 *
 * A class with no teacher and a class with no subject are the two things that
 * stop a timetable, a mark sheet and a report card from working, so they are
 * worth a panel — but only if the panel says how many of how many, and offers
 * the page that fixes it. When nothing is missing it says so and gets quiet.
 */
export function AcademicsSetupPanel({
  summary,
}: {
  summary: AcademicsDashboardSummary;
}) {
  const total = summary.totalClasses;
  const withTeacher = Math.max(0, total - summary.classesWithoutTeachers);
  const withSubject = Math.max(0, total - summary.classesWithoutSubjects);
  const done = total > 0 && withTeacher === total && withSubject === total;

  const rows = [
    {
      label: "Classes with a teacher",
      have: withTeacher,
      href: "/academics/classes",
      action: "Assign teachers",
      note:
        summary.teachersAssigned === 1
          ? "1 teacher assigned this year"
          : `${summary.teachersAssigned} teachers assigned this year`,
      icon: UserCog,
    },
    {
      label: "Classes with subjects",
      have: withSubject,
      href: "/academics/subjects",
      action: "Assign subjects",
      note: `${summary.totalSubjects} subjects in the catalogue`,
      icon: BookOpen,
    },
  ];

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Class setup</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {summary.activeAcademicYear || "No active year"} &middot; {total}{" "}
            {total === 1 ? "class" : "classes"}
          </p>
        </div>
        {done && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Everything is set up
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {rows.map((r) => {
          const missing = total - r.have;
          const percent = total ? Math.round((r.have / total) * 100) : 0;
          return (
            <div key={r.label} className="rounded-xl border bg-background/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <r.icon className="h-4 w-4 text-muted-foreground" />
                  {r.label}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {r.have}
                  <span className="text-muted-foreground"> / {total}</span>
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    missing === 0 ? "bg-emerald-500" : "bg-primary",
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {missing > 0
                    ? `${missing} still to set up \u00b7 ${r.note}`
                    : r.note}
                </p>
                {missing > 0 && (
                  <Link
                    href={r.href}
                    className="whitespace-nowrap text-xs font-medium text-primary hover:underline"
                  >
                    {r.action}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
