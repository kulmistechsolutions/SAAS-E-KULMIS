"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  GraduationCap,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  REPORT_CATEGORIES,
  searchReports,
  searchTeacherReports,
  teacherReportCategories,
  totalReportCount,
} from "@/lib/reports/catalog";
import { activeAcademicYear } from "@/lib/academics/store";
import { useAuth } from "@/lib/auth";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  students: Users,
  teachers: GraduationCap,
  attendance: ClipboardList,
  fees: Wallet,
  examinations: FileText,
  promotions: TrendingUp,
  salary: DollarSign,
  expenses: BarChart3,
  financial: DollarSign,
  quiz: BookOpenCheck,
};

export default function ReportsDashboardPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => setMounted(true), []);

  const categories = useMemo(
    () => (isTeacher ? teacherReportCategories() : REPORT_CATEGORIES),
    [isTeacher],
  );
  const results = useMemo(
    () => (isTeacher ? searchTeacherReports(query) : searchReports(query)),
    [query, isTeacher],
  );
  const year = mounted ? activeAcademicYear() : "";
  const count = categories.reduce((n, c) => n + c.reports.length, 0);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading reports center…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isTeacher ? "My Reports" : "Reports Center"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isTeacher
            ? `${count} reports for your assigned classes and subjects.`
            : `Centralized analytics — ${totalReportCount()} reports across ${REPORT_CATEGORIES.length} categories.`}{" "}
          Academic Year {year}.
        </p>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reports by name or category…"
          className="h-11 w-full rounded-xl border bg-card pl-10 pr-4 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {query.trim() ? (
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-5 py-3 text-sm font-medium">
            Search Results ({results.length})
          </div>
          <ul className="divide-y">
            {results.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                No reports found.
              </li>
            ) : (
              results.map(({ category, report }) => (
                <li key={`${category.id}-${report.slug}`}>
                  <Link
                    href={`/reports/${category.id}/${report.slug}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{report.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.label} · {report.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const Icon = ICONS[cat.id] ?? FileText;
            return (
              <div
                key={cat.id}
                className="rounded-2xl border bg-card p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold">{cat.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {cat.reports.length} reports
                    </p>
                  </div>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  {cat.description}
                </p>
                <ul className="space-y-1">
                  {cat.reports.slice(0, 4).map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/reports/${cat.id}/${r.slug}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {r.title}
                      </Link>
                    </li>
                  ))}
                  {cat.reports.length > 4 && (
                    <li className="text-xs text-muted-foreground">
                      +{cat.reports.length - 4} more
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
