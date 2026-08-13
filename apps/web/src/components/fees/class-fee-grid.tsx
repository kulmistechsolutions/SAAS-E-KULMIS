"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { classFeeSummaries } from "@/lib/fees/store";
import { moneyPlain, monthLabel } from "@/lib/fees/format";
import { printClassFeeSummaries } from "@/lib/fees/print";
import { useStudentsState } from "@/lib/students/store";
import { useAcademicsState } from "@/lib/academics/store";

interface Props {
  academicYear: string;
  monthKey: string;
  onSelectClass: (className: string) => void;
}

/**
 * Entry screen for Collect Fees > By Class — one card per class with this
 * month's headline numbers, so an admin sees where money is owed before
 * drilling into any one class's student list.
 */
export function ClassFeeGrid({ academicYear, monthKey, onSelectClass }: Props) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  // Subscribe so the grid recomputes once students/fees hydrate.
  const studentsState = useStudentsState();
  const academics = useAcademicsState();
  useEffect(() => setMounted(true), []);

  const summaries = useMemo(
    () => (mounted ? classFeeSummaries(academicYear, monthKey) : []),
    [mounted, academicYear, monthKey, studentsState, academics],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("feesClassFeeSummary.pickAClassToCollect")}
        </p>
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

      {mounted && summaries.length === 0 && (
        <div className="rounded-2xl border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          {t("feesClassFeeSummary.noClasses")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {summaries.map((c) => (
          <button
            key={c.className}
            type="button"
            onClick={() => onSelectClass(c.className)}
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 text-start shadow-sm transition-colors hover:border-primary/50 hover:bg-secondary/40"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{c.className}</h3>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {c.totalStudents}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric
                label={t("feesClassFeeSummary.outstanding")}
                value={moneyPlain(c.outstandingAmount)}
                tone="danger"
              />
              <Metric
                label={t("feesClassFeeSummary.paid")}
                value={String(c.paidStudents)}
                tone="success"
              />
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
          </button>
        ))}
      </div>
    </div>
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
