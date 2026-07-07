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
import { REPORT_CATEGORIES, searchReports, totalReportCount } from "@/lib/reports/catalog";
import { activeAcademicYear } from "@/lib/academics/store";
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
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => setMounted(true), []);

  const results = useMemo(() => searchReports(query), [query]);
  const year = mounted ? activeAcademicYear() : "";

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
        <h1 className="text-2xl font-bold">Reports Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Centralized analytics — {totalReportCount()} reports across {REPORT_CATEGORIES.length} categories.
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
              <li className="px-5 py-10 text-center text-sm text-muted-foreground">No reports found.</li>
            ) : (
              results.map(({ category, report }) => (
                <li key={`${category.id}-${report.slug}`}>
                  <Link
                    href={`/reports/${category.id}/${report.slug}`}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-secondary/40"
                  >
                    <div>
                      <p className="font-medium">{report.title}</p>
                      <p className="text-xs text-muted-foreground">{category.label}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {REPORT_CATEGORIES.map((cat) => {
            const Icon = ICONS[cat.id] ?? BarChart3;
            return (
              <Link
                key={cat.id}
                href={`/reports/${cat.id}`}
                className="group flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </span>
                <p className="mt-4 font-semibold">{cat.label}</p>
                <p className="mt-1 flex-1 text-xs text-muted-foreground line-clamp-2">{cat.description}</p>
                <p className="mt-3 text-xs font-medium text-primary">
                  {cat.reports.length} reports <ChevronRight className="ml-0.5 inline h-3 w-3" />
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
