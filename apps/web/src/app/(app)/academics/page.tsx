"use client";


import { useT } from "@/lib/i18n/provider";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  Layers,
  Library,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  AcademicsSetupPanel,
  AcademicsSummaryCards,
} from "@/components/academics/summary-cards";
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
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Where this module goes.
 *
 * These were four full cards in a row of their own, repeating the sidebar in
 * larger type. As a strip under the heading they take one line and leave the
 * page to the figures.
 */
const QUICK = [
  { href: "/academics/classes", label: "Classes", desc: "Manage class list", icon: Library },
  { href: "/academics/sections", label: "Sections", desc: "Manage sections", icon: Layers },
  { href: "/academics/subjects", label: "Subjects", desc: "Manage subjects", icon: BookOpen },
  { href: "/academics/years", label: "Academic Years", desc: "Manage school years", icon: CalendarDays },
];

export default function AcademicsDashboardPage() {
  const t = useT();
  const mounted = useHydrated();
  const state = useAcademicsState();
  const [yearOpen, setYearOpen] = useState(false);

  const summary = useMemo(() => dashboardSummary(), [state]);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("academics.loadingAcademics")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("academics.classAmpSectionManagement")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("academics.theAcademicFoundationYearsClassesSections")}
          </p>
        </div>
        <button
          onClick={() => setYearOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="me-2 h-4 w-4" /> {t("academics.addAcademicYear")}
        </button>
      </div>

      {/* ── Where this module goes ──────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            title={q.desc}
            className="group inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <q.icon className="h-4 w-4" />
            </span>
            {q.label}
          </Link>
        ))}
      </div>

      {/* ── What the school has ─────────────────────────── */}
      <AcademicsSummaryCards summary={summary} />

      {/* ── What is still missing ──────────────────────── */}
      <AcademicsSetupPanel summary={summary} />

      {/* ── The year list, and what people changed ──────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">{t("academics.academicYears")}</h2>
            <Link href="/academics/years" className="text-xs font-medium text-primary hover:underline">
              {t("academics.manage")}
            </Link>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-start text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 text-start font-medium">{t("academics.year")}</th>
                <th className="px-5 py-2.5 text-start font-medium">{t("academics.start")}</th>
                <th className="px-5 py-2.5 text-start font-medium">{t("academics.end")}</th>
                <th className="px-5 py-2.5 text-start font-medium">{t("academics.status")}</th>
                <th className="px-5 py-2.5 text-end font-medium">{t("academics.action")}</th>
              </tr>
            </thead>
            <tbody>
              {state.academicYears.map((y) => (
                <tr key={y.id} className="border-t">
                  <td className="whitespace-nowrap px-5 py-3 font-medium">{y.name}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{shortDate(y.startDate)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{shortDate(y.endDate)}</td>
                  <td className="px-5 py-3"><StatusBadge status={y.status} /></td>
                  <td className="px-5 py-3 text-end">
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
                        {t("academics.setActive")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">{t("academics.recentActivity")}</h2>
            <span className="text-xs text-muted-foreground">{t("academics.auditLog")}</span>
          </div>
          <ul className="max-h-[320px] divide-y overflow-auto scrollbar-slim">
            {state.audit.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                {t("academics.noActivityYet")}
              </li>
            ) : (
              state.audit.slice(0, 20).map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.action}</p>
                    {a.detail && (
                      <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
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
          onClick={() => { resetAcademics(); toast(t("academics.listReloaded"), "info"); }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> {t("academics.reloadList")}
        </button>
      </div>

      <AcademicYearDialog open={yearOpen} onClose={() => setYearOpen(false)} />
    </div>
  );
}
