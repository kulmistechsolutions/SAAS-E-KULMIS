"use client";

import Link from "next/link";
import { BarChart3, FileText, Users } from "lucide-react";

const REPORTS = [
  { title: "Monthly Collection Report", href: "/finance/history", icon: BarChart3 },
  { title: "Outstanding Report", href: "/finance", icon: Users },
  { title: "Partial Payment Report", href: "/finance/history", icon: FileText },
  { title: "Advance Payment Report", href: "/finance/history", icon: FileText },
  { title: "Student Ledger", href: "/students", icon: Users },
  { title: "Daily Collection Report", href: "/finance/history", icon: BarChart3 },
  { title: "Annual Collection Report", href: "/finance/history", icon: BarChart3 },
  { title: "Collection by Class", href: "/finance/reports", icon: BarChart3 },
  { title: "Collection by Section", href: "/finance/reports", icon: BarChart3 },
];

export default function FeeReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fee Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View, search, filter, print, and export fee reports.
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
