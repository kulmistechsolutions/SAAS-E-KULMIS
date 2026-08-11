"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { feeStatusLabel, money } from "@/lib/fees/format";
import { listStudentFees, useFeesState } from "@/lib/fees/store";
import { useStudentsState } from "@/lib/students/store";
import type { FeeChargeStatus, StudentFeeRow } from "@/lib/fees/types";
import {
  classNamesForYear,
  groupClassNames,
  sectionNamesForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { FeeStatusBadge, FreeStudentBadge } from "./fee-status-badge";

const PAGE_SIZE = 8;

interface CollectFeesSectionProps {
  academicYear: string;
  monthKey: string;
  onPay: (row: StudentFeeRow) => void;
  compact?: boolean;
}

export function CollectFeesSection({
  academicYear,
  monthKey,
  onPay,
  compact = false,
}: CollectFeesSectionProps) {
  const t = useT();
  const [klass, setKlass] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FeeChargeStatus | "ADVANCE_MULTI" | "">("");
  const [applied, setApplied] = useState({ klass: "", section: "", search: "", status: "" as FeeChargeStatus | "ADVANCE_MULTI" | "" });
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);
  const academics = useAcademicsState();
  // Subscribe to the students + fees stores so the table recomputes once their
  // data finishes loading (both hydrate asynchronously after first render).
  const studentsState = useStudentsState();
  const feesState = useFeesState();
  useEffect(() => setMounted(true), []);

  const classOptions = useMemo(
    () => classNamesForYear(academicYear),
    [academicYear, academics.classes],
  );
  const classGroups = useMemo(
    () => groupClassNames(classOptions, academicYear, t("common.defaultGrades")),
    [classOptions, academicYear, academics.structureTrees, t],
  );
  const sectionOptions = useMemo(
    () => (klass ? sectionNamesForClass(klass, academicYear) : []),
    [klass, academicYear, academics.sections],
  );

  const rows = useMemo(
    () =>
      mounted
        ? listStudentFees({
            academicYear,
            monthKey,
            className: applied.klass || undefined,
            section: applied.section || undefined,
            search: applied.search || undefined,
            status: applied.status || undefined,
          })
        : [],
    // studentsState / feesState included so rows recompute when they hydrate.
    [mounted, academicYear, monthKey, applied, studentsState, feesState],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function applyFilters() {
    setApplied({ klass, section, search, status });
    setPage(1);
  }

  function resetFilters() {
    setKlass("");
    setSection("");
    setSearch("");
    setStatus("");
    setApplied({ klass: "", section: "", search: "", status: "" });
    setPage(1);
  }

  function onClassChange(next: string) {
    setKlass(next);
    setSection("");
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">{t("feesCollectFeesSection.collectFees")}</h2>
        {!compact && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("feesCollectFeesSection.filterByClassAndSectionThen")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 border-b bg-secondary/20 px-5 py-4">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("feesCollectFeesSection.class")}
          </label>
          <Select value={klass} onChange={(e) => onClassChange(e.target.value)}>
            <option value="">{t("feesCollectFeesSection.allClasses")}</option>
            {classGroups.map((g) =>
              g.label === null ? (
                g.names.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              ) : (
                <optgroup key={g.label} label={g.label}>
                  {g.names.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </Select>
        </div>
        <div className="min-w-[120px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("feesCollectFeesSection.section")}
          </label>
          <Select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            disabled={!klass || sectionOptions.length === 0}
          >
            <option value="">{t("feesCollectFeesSection.allSections")}</option>
            {sectionOptions.map((s) => (
              <option key={s} value={s}>
                {t("feesCollectFeesSection.section")} {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[180px] flex-[2]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("feesCollectFeesSection.searchStudent")}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder={t("feesCollectFeesSection.nameOrId")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("feesCollectFeesSection.status")}
          </label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as FeeChargeStatus | "ADVANCE_MULTI" | "")}
          >
            <option value="">{t("feesCollectFeesSection.allStatuses")}</option>
            <option value="UNPAID">{feeStatusLabel("UNPAID")}</option>
            <option value="PARTIAL">{feeStatusLabel("PARTIAL")}</option>
            <option value="PAID">{feeStatusLabel("PAID")}</option>
            <option value="ADVANCE">{feeStatusLabel("ADVANCE")}</option>
            <option value="ADVANCE_MULTI">{t("feesCollectFeesSection.advanceMultipleMonths")}</option>
            <option value="INACTIVE">{feeStatusLabel("INACTIVE")}</option>
          </Select>
        </div>
        <Button onClick={applyFilters}>{t("feesCollectFeesSection.search")}</Button>
        <Button variant="outline" onClick={resetFilters}>
          {t("feesCollectFeesSection.reset")}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-secondary/90 text-start text-xs text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">{t("feesCollectFeesSection.studentId")}</th>
              <th className="px-4 py-2.5 font-medium">{t("feesCollectFeesSection.studentName")}</th>
              <th className="px-4 py-2.5 font-medium">{t("feesCollectFeesSection.monthlyFee")}</th>
              <th className="px-4 py-2.5 font-medium">{t("feesCollectFeesSection.outstandingBalance")}</th>
              <th className="px-4 py-2.5 font-medium">{t("feesCollectFeesSection.status")}</th>
              <th className="px-4 py-2.5 font-medium">{t("feesCollectFeesSection.action")}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => {
              const canPay =
                r.status === "UNPAID" ||
                r.status === "PARTIAL" ||
                (r.outstandingBalance > 0 && r.status !== "ADVANCE_MULTI");
              return (
                <tr key={r.studentId} className="border-t">
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2.5 font-medium">{r.fullName}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(r.monthlyFee)}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">
                    {money(r.outstandingBalance)}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.feeWaived || r.monthlyFee === 0 ? (
                      <FreeStudentBadge />
                    ) : (
                      <FeeStatusBadge
                        status={r.status}
                        advanceMonthsLeft={r.advanceMonthsLeft}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {canPay ? (
                      <Button
                        className="h-8 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
                        onClick={() => onPay(r)}
                      >
                        {t("feesCollectFeesSection.pay")}
                      </Button>
                    ) : (
                      <Link
                        href={`/students/${r.studentId}`}
                        className="inline-flex h-8 items-center rounded-lg border border-primary px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                      >
                        <Eye className="me-1 h-3.5 w-3.5" />
                        {t("feesCollectFeesSection.view")}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {mounted && pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {t("feesCollectFeesSection.noStudentsMatchYourFilters")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > PAGE_SIZE && (
        <div className="border-t px-4 py-3">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={rows.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
