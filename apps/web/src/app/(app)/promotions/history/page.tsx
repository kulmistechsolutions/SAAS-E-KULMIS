"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileDown, GraduationCap, Printer, Search, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { PromotionTypeBadge } from "@/components/promotions/badges";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  exportPromotionHistoryCsv,
  promotionHistory,
  rollbackPromotion,
  usePromotionsState,
} from "@/lib/promotions/store";
import { getAcademicsState } from "@/lib/academics/store";
import { dateTime } from "@/lib/promotions/format";
import { printTable } from "@/lib/promotions/print";
import type { PromotionRecord, PromotionType } from "@/lib/promotions/types";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 12;

export default function PromotionHistoryPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = usePromotionsState();

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [includeRolledBack, setIncludeRolledBack] = useState(false);
  const [page, setPage] = useState(1);
  const [rolling, setRolling] = useState<PromotionRecord | null>(null);

  const years = getAcademicsState().academicYears;

  const rows = useMemo(
    () =>
      promotionHistory({
        search,
        academicYear: year || undefined,
        type: (type || undefined) as PromotionType | undefined,
        includeRolledBack,
      }),
    [state, search, year, type, includeRolledBack],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setPage(1), [search, year, type, includeRolledBack]);

  const hasFilters = !!(search || year || type);

  function handleRollback() {
    if (!rolling) return;
    const res = rollbackPromotion(rolling.id);
    if (!res.ok) toast(res.error ?? "Rollback failed.", "error");
    else toast(`${rolling.studentName}'s promotion was rolled back.`, "success");
    setRolling(null);
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading history…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Promotion History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete, permanent record of every promotion and graduation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              printTable({
                title: "Promotion History Report",
                columns: ["Student", "Type", "From", "To", "Year", "Date"],
                rows: rows.map((r) => [
                  `${r.studentName} (${r.studentCode})`,
                  r.type,
                  `${r.fromClass}${r.fromSection ? ` ${r.fromSection}` : ""}`,
                  r.graduated ? "Graduated" : `${r.toClass}${r.toSection ? ` ${r.toSection}` : ""}`,
                  r.fromAcademicYear,
                  new Date(r.promotedAt).toLocaleDateString(),
                ]),
              })
            }
          >
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" onClick={() => { exportPromotionHistoryCsv(rows); toast(`Exported ${rows.length} records.`, "info"); }}>
            <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student, ID or class…"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select value={year} onChange={(e) => setYear(e.target.value)} className="lg:w-40">
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y.id} value={y.name}>{y.name}</option>
              ))}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value)} className="lg:w-36">
              <option value="">All Types</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="CLASS">Class</option>
              <option value="SCHOOL_WIDE">School-Wide</option>
            </Select>
            <label className="flex h-10 items-center gap-2 rounded-lg border px-3 text-sm">
              <input type="checkbox" checked={includeRolledBack} onChange={(e) => setIncludeRolledBack(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Rolled back
            </label>
            {hasFilters && (
              <Button variant="ghost" onClick={() => { setSearch(""); setYear(""); setType(""); }}>
                <X className="mr-1 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[600px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 font-medium">Academic Year</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">By</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    No promotion records match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link href={`/students/${r.studentId}`} className="font-medium hover:text-primary hover:underline">
                        {r.studentName}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{r.studentCode}</span>
                    </td>
                    <td className="px-4 py-3"><PromotionTypeBadge type={r.type} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{r.fromClass}{r.fromSection ? ` (${r.fromSection})` : ""}</td>
                    <td className="px-4 py-3">
                      {r.graduated ? (
                        <span className="inline-flex items-center gap-1 font-medium text-sky-600 dark:text-sky-400">
                          <GraduationCap className="h-4 w-4" /> Graduated
                        </span>
                      ) : (
                        `${r.toClass}${r.toSection ? ` (${r.toSection})` : ""}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.fromAcademicYear}</td>
                    <td className="px-4 py-3 text-muted-foreground">{dateTime(r.promotedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.promotedBy}</td>
                    <td className="px-4 py-3 text-right">
                      {r.rolledBackAt ? (
                        <Badge tone="muted">Rolled back</Badge>
                      ) : (
                        <button
                          onClick={() => setRolling(r)}
                          title="Rollback"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3">
          <Pagination page={currentPage} pageCount={pageCount} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      <ConfirmDialog
        open={!!rolling}
        title="Rollback Promotion"
        message={rolling ? `Reverse ${rolling.studentName}'s promotion (${rolling.fromClass} → ${rolling.graduated ? "Graduated" : rolling.toClass})? The student returns to their previous class. This is logged.` : ""}
        confirmLabel="Rollback"
        onConfirm={handleRollback}
        onClose={() => setRolling(null)}
      />
    </div>
  );
}
