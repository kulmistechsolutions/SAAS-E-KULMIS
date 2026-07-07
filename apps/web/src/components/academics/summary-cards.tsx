import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CalendarCheck,
  Layers,
  Library,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AcademicsDashboardSummary } from "@/lib/academics/types";

interface CardDef {
  key: keyof AcademicsDashboardSummary;
  label: string;
  icon: LucideIcon;
  chip: string;
  danger?: boolean;
}

const CARDS: CardDef[] = [
  { key: "totalAcademicYears", label: "Academic Years", icon: CalendarDays, chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { key: "activeAcademicYear", label: "Active Year", icon: CalendarCheck, chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { key: "totalClasses", label: "Total Classes", icon: Library, chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  { key: "totalSections", label: "Total Sections", icon: Layers, chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  { key: "totalSubjects", label: "Total Subjects", icon: BookOpen, chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { key: "totalStudents", label: "Total Students", icon: Users, chip: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
  { key: "teachersAssigned", label: "Teachers Assigned", icon: UserCog, chip: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" },
  { key: "classesWithoutTeachers", label: "Classes w/o Teachers", icon: AlertTriangle, chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400", danger: true },
  { key: "classesWithoutSubjects", label: "Classes w/o Subjects", icon: AlertTriangle, chip: "bg-orange-500/15 text-orange-600 dark:text-orange-400", danger: true },
];

export function AcademicsSummaryCards({
  summary,
}: {
  summary: AcademicsDashboardSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((c) => {
        const value = summary[c.key];
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
              <span
                className={cn(
                  "text-xl font-bold tabular-nums",
                  c.danger && Number(value) > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-foreground",
                )}
              >
                {typeof value === "number" ? value.toLocaleString() : value || "—"}
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
