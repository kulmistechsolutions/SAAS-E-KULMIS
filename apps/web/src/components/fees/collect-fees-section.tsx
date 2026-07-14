"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { money } from "@/lib/fees/format";
import { listStudentFees, useFeesState } from "@/lib/fees/store";
import { useStudentsState } from "@/lib/students/store";
import type { StudentFeeRow } from "@/lib/fees/types";
import {
  classNamesForYear,
  sectionNamesForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { FeeStatusBadge } from "./fee-status-badge";

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
  const [klass, setKlass] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState({ klass: "", section: "", search: "" });
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
          })
        : [],
    // studentsState / feesState included so rows recompute when they hydrate.
    [mounted, academicYear, monthKey, applied, studentsState, feesState],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function applyFilters() {
    setApplied({ klass, section, search });
    setPage(1);
  }

  function resetFilters() {
    setKlass("");
    setSection("");
    setSearch("");
    setApplied({ klass: "", section: "", search: "" });
    setPage(1);
  }

  function onClassChange(next: string) {
    setKlass(next);
    setSection("");
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">Collect Fees</h2>
        {!compact && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Filter by class and section, then collect payments.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 border-b bg-secondary/20 px-5 py-4">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Class
          </label>
          <Select value={klass} onChange={(e) => onClassChange(e.target.value)}>
            <option value="">All Classes</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[120px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Section
          </label>
          <Select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            disabled={!klass || sectionOptions.length === 0}
          >
            <option value="">All Sections</option>
            {sectionOptions.map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[180px] flex-[2]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Search Student
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
        </div>
        <Button onClick={applyFilters}>Search</Button>
        <Button variant="outline" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Student ID</th>
              <th className="px-4 py-2.5 font-medium">Student Name</th>
              <th className="px-4 py-2.5 font-medium">Monthly Fee</th>
              <th className="px-4 py-2.5 font-medium">Outstanding Balance</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
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
                    <FeeStatusBadge
                      status={r.status}
                      advanceMonthsLeft={r.advanceMonthsLeft}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {canPay ? (
                      <Button
                        className="h-8 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
                        onClick={() => onPay(r)}
                      >
                        Pay
                      </Button>
                    ) : (
                      <Link
                        href={`/students/${r.studentId}`}
                        className="inline-flex h-8 items-center rounded-lg border border-primary px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {mounted && pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No students match your filters.
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
