"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Layers,
  Library,
  Plus,
  RotateCcw,
} from "lucide-react";
import { AcademicsSummaryCards } from "@/components/academics/summary-cards";
import { StatusBadge } from "@/components/academics/status-badge";
import { AcademicYearDialog } from "@/components/academics/academic-year-dialog";
import {
  dashboardSummary,
  resetAcademics,
  setActiveAcademicYear,
  useAcademicsState,
} from "@/lib/academics/store";
import { shortDate } from "@/lib/academics/format";
import { toast } from "@/lib/toast";

const QUICK = [
  { href: "/academics/classes", label: "Classes", desc: "Manage class list", icon: Library },
  { href: "/academics/sections", label: "Sections", desc: "Manage sections", icon: Layers },
  { href: "/academics/subjects", label: "Subjects", desc: "Manage subjects", icon: BookOpen },
  { href: "/academics/years", label: "Academic Years", desc: "Manage school years", icon: CalendarDays },
];

export default function AcademicsDashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = useAcademicsState();
  const [yearOpen, setYearOpen] = useState(false);

  const summary = useMemo(() => dashboardSummary(), [state]);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading academics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Class &amp; Section Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The academic foundation — years, classes, sections, and subjects.
          </p>
        </div>
        <button
          onClick={() => setYearOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Academic Year
        </button>
      </div>

      <AcademicsSummaryCards summary={summary} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <q.icon className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">{q.label}</p>
              <p className="text-xs text-muted-foreground">{q.desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">Academic Years</h2>
            <Link href="/academics/years" className="text-xs font-medium text-primary hover:underline">
              Manage
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">Year</th>
                <th className="px-5 py-2.5 font-medium">Start</th>
                <th className="px-5 py-2.5 font-medium">End</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {state.academicYears.map((y) => (
                <tr key={y.id} className="border-t">
                  <td className="px-5 py-3 font-medium">{y.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{shortDate(y.startDate)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{shortDate(y.endDate)}</td>
                  <td className="px-5 py-3"><StatusBadge status={y.status} /></td>
                  <td className="px-5 py-3 text-right">
                    {y.status !== "ACTIVE" && (
                      <button
                        onClick={async () => {
                          const res = await setActiveAcademicYear(y.id);
                          toast(
                            res.ok
                              ? `${y.name} is now the active academic year.`
                              : res.error ?? "Failed to set active year.",
                            res.ok ? "success" : "error",
                          );
                        }}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Set Active
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">Recent Activity</h2>
            <span className="text-xs text-muted-foreground">Audit log</span>
          </div>
          <ul className="max-h-[320px] divide-y overflow-auto scrollbar-slim">
            {state.audit.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                No activity yet.
              </li>
            ) : (
              state.audit.slice(0, 20).map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{a.action}</p>
                    {a.detail && (
                      <p className="text-xs text-muted-foreground">{a.detail}</p>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {shortDate(a.at)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => { resetAcademics(); toast("Demo academic data reset.", "info"); }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
        </button>
      </div>

      <AcademicYearDialog open={yearOpen} onClose={() => setYearOpen(false)} />
    </div>
  );
}
