"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, LayoutGrid, List, Printer, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/provider";
import { classFeeSummaries } from "@/lib/fees/store";
import { moneyPlain, monthLabel } from "@/lib/fees/format";
import { printClassFeeSummaries } from "@/lib/fees/print";
import { useStudentsState } from "@/lib/students/store";
import { useAcademicsState } from "@/lib/academics/store";
import { cn } from "@/lib/utils";
import type { ClassFeeSummary } from "@/lib/fees/types";

interface Props {
  academicYear: string;
  monthKey: string;
  onSelectClass: (className: string) => void;
}

type ViewMode = "grid" | "list";

/**
 * Entry screen for Collect Fees > By Class — one card per class with this
 * month's headline numbers, so an admin sees where money is owed before
 * drilling into any one class's student list.
 */
export function ClassFeeGrid({ academicYear, monthKey, onSelectClass }: Props) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  // Subscribe so the grid recomputes once students/fees hydrate.
  const studentsState = useStudentsState();
  const academics = useAcademicsState();
  useEffect(() => setMounted(true), []);

  const summaries = useMemo(
    () => (mounted ? classFeeSummaries(academicYear, monthKey) : []),
    [mounted, academicYear, monthKey, studentsState, academics],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((c) => c.className.toLowerCase().includes(q));
  }, [summaries, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("feesClassFeeSummary.pickAClassToCollect")}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-48 ps-9"
              placeholder={t("feesClassFeeSummary.searchClass")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="inline-flex rounded-lg border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label={t("feesClassFeeSummary.gridView")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                view === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label={t("feesClassFeeSummary.listView")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="outline"
            disabled={summaries.length === 0}
            onClick={() =>
              printClassFeeSummaries(summaries, { academicYear, monthLabel: monthLabel(monthKey) })
            }
          >
            <Printer className="me-2 h-4 w-4" /> {t("feesClassFeeSummary.print")}
          </Button>
        </div>
      </div>

      {mounted && summaries.length === 0 && (
        <div className="rounded-2xl border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          {t("feesClassFeeSummary.noClasses")}
        </div>
      )}

      {mounted && summaries.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          {t("feesClassFeeSummary.noClassesMatchSearch")}
        </div>
      )}

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => (
            <ClassCard key={c.className} summary={c} onSelect={() => onSelectClass(c.className)} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-secondary/50 text-start text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">{t("feesClassFeeSummary.class")}</th>
                  <th className="px-4 py-3 font-medium">{t("feesClassFeeSummary.totalStudents")}</th>
                  <th className="px-4 py-3 font-medium">{t("feesClassFeeSummary.outstanding")}</th>
                  <th className="px-4 py-3 font-medium">{t("feesClassFeeSummary.paid")}</th>
                  <th className="px-4 py-3 font-medium">{t("feesClassFeeSummary.advance")}</th>
                  <th className="px-4 py-3 font-medium">{t("feesClassFeeSummary.partial")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.className}
                    onClick={() => onSelectClass(c.className)}
                    className="cursor-pointer border-t transition-colors hover:bg-secondary/40"
                  >
                    <td className="px-5 py-3 font-medium text-foreground">{c.className}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.totalStudents}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-rose-600 dark:text-rose-400">
                      {moneyPlain(c.outstandingAmount)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-emerald-600 dark:text-emerald-400">
                      {c.paidStudents}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-sky-600 dark:text-sky-400">
                      {c.advanceStudents}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-amber-600 dark:text-amber-400">
                      {c.partialStudents}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <ChevronRight className="ms-auto h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassCard({
  summary: c,
  onSelect,
}: {
  summary: ClassFeeSummary;
  onSelect: () => void;
}) {
  const t = useT();
  const billable = c.totalStudents - c.freeStudents;
  const collectedPct = billable > 0 ? Math.round((c.paidStudents / billable) * 100) : 100;
  const barTone =
    collectedPct >= 75 ? "bg-emerald-500" : collectedPct >= 40 ? "bg-amber-500" : "bg-rose-500";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col gap-3.5 overflow-hidden rounded-2xl border bg-card p-4 text-start shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="break-words text-[15px] font-semibold leading-snug text-foreground">
          {c.className}
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <Users className="h-3 w-3" />
          {c.totalStudents}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", barTone)}
          style={{ width: `${collectedPct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric
          label={t("feesClassFeeSummary.outstanding")}
          value={moneyPlain(c.outstandingAmount)}
          tone="danger"
        />
        <Metric label={t("feesClassFeeSummary.paid")} value={String(c.paidStudents)} tone="success" />
        <Metric
          label={t("feesClassFeeSummary.advance")}
          value={String(c.advanceStudents)}
          tone="info"
        />
        <Metric
          label={t("feesClassFeeSummary.partial")}
          value={String(c.partialStudents)}
          tone="warning"
        />
      </div>

      <div className="flex items-center justify-end gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        {t("feesClassFeeSummary.view")}
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}

const TONE_CLASS: Record<string, string> = {
  danger: "text-rose-600 dark:text-rose-400",
  success: "text-emerald-600 dark:text-emerald-400",
  info: "text-sky-600 dark:text-sky-400",
  warning: "text-amber-600 dark:text-amber-400",
};

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-semibold tabular-nums ${TONE_CLASS[tone] ?? ""}`}>{value}</div>
    </div>
  );
}
