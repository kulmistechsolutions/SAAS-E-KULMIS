"use client";

import Link from "next/link";
import { BarChart3, FileText, TrendingDown, TrendingUp, Users } from "lucide-react";

const REPORTS = [
  { title: "Class Results", href: "/examinations/results", icon: Users },
  { title: "Section Results", href: "/examinations/results", icon: Users },
  { title: "Subject Results", href: "/examinations/marks", icon: FileText },
  { title: "Teacher Submission Report", href: "/examinations/monitoring", icon: BarChart3 },
  { title: "Pass / Fail Analysis", href: "/examinations/results", icon: BarChart3 },
  { title: "Grade Distribution", href: "/examinations/results", icon: BarChart3 },
  { title: "Top Students", href: "/examinations/results", icon: TrendingUp },
  { title: "Bottom Students", href: "/examinations/results", icon: TrendingDown },
  { title: "Result Statistics", href: "/examinations", icon: BarChart3 },
];

export default function ExamReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exam Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View, search, filter, print, and export examination reports.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link
            key={r.title}
            href={r.href}
            className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <r.icon className="h-5 w-5" />
            </span>
            <span className="font-medium">{r.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
