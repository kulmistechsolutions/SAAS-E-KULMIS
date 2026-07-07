"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  GraduationCap,
  History,
  RotateCcw,
  Settings,
  Sparkles,
} from "lucide-react";
import { PromotionSummaryCards } from "@/components/promotions/summary-cards";
import { PromotionTypeBadge } from "@/components/promotions/badges";
import {
  dashboardSummary,
  promotionHistory,
  resetPromotions,
  usePromotionsState,
} from "@/lib/promotions/store";
import { dateTime } from "@/lib/promotions/format";
import { toast } from "@/lib/toast";

const QUICK = [
  { href: "/promotions/promote", label: "Promote Students", desc: "Individual, class or school-wide", icon: Sparkles },
  { href: "/promotions/graduated", label: "Graduated Students", desc: "View & print transcripts", icon: GraduationCap },
  { href: "/promotions/history", label: "Promotion History", desc: "Full audit trail", icon: History },
  { href: "/promotions/settings", label: "Eligibility Rules", desc: "Configure requirements", icon: Settings },
];

export default function PromotionsDashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = usePromotionsState();

  const summary = useMemo(() => dashboardSummary(), [state]);
  const recent = useMemo(() => promotionHistory().slice(0, 10), [state]);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading promotions…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Promotion &amp; Graduation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Advance students between classes and academic years — history preserved.
          </p>
        </div>
        <Link
          href="/promotions/promote"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Sparkles className="mr-2 h-4 w-4" /> Start Promotion
        </Link>
      </div>

      <PromotionSummaryCards summary={summary} />

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

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Recent Promotions</h2>
          <Link href="/promotions/history" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="max-h-[420px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="sticky top-0 bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">Student</th>
                <th className="px-5 py-2.5 font-medium">Type</th>
                <th className="px-5 py-2.5 font-medium">From</th>
                <th className="px-5 py-2.5 font-medium">To</th>
                <th className="px-5 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                    No promotions recorded yet. Start your first promotion.
                  </td>
                </tr>
              ) : (
                recent.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-5 py-3">
                      <Link href={`/students/${r.studentId}`} className="font-medium hover:text-primary hover:underline">
                        {r.studentName}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{r.studentCode}</span>
                    </td>
                    <td className="px-5 py-3"><PromotionTypeBadge type={r.type} /></td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {r.fromClass}{r.fromSection ? ` (${r.fromSection})` : ""}
                    </td>
                    <td className="px-5 py-3">
                      {r.graduated ? (
                        <span className="inline-flex items-center gap-1 font-medium text-sky-600 dark:text-sky-400">
                          <GraduationCap className="h-4 w-4" /> Graduated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium">
                          <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                          {r.toClass}{r.toSection ? ` (${r.toSection})` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{dateTime(r.promotedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => { resetPromotions(); toast("Promotion history reset.", "info"); }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset promotion data
        </button>
      </div>
    </div>
  );
}
