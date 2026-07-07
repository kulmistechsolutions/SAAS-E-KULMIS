"use client";

import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { REPORT_CATEGORIES } from "@/lib/reports/catalog";

const SALARY_REPORTS = REPORT_CATEGORIES.find((c) => c.id === "salary")?.reports ?? [];

const EXTRA = [
  {
    href: "/reports/financial/salary",
    title: "Finance — Salary Report",
    description: "Salary outflow in financial statements.",
  },
  {
    href: "/reports/financial/net-income",
    title: "Net Income Report",
    description: "Fee collection minus expenses and salaries.",
  },
];

export default function SalaryReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Salary Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Payroll analytics with print, PDF, and CSV export via Reports Center.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SALARY_REPORTS.map((r) => (
          <Link
            key={r.slug}
            href={`/reports/salary/${r.slug}`}
            className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">{r.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </Link>
        ))}
        {EXTRA.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <FileText className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">{r.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}
