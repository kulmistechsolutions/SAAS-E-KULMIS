"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/fees/format";
import { listFamilies, useFeesState } from "@/lib/fees/store";
import { useStudentsState } from "@/lib/students/store";
import type { FamilyFeeRow } from "@/lib/fees/types";
import { FeeStatusBadge } from "./fee-status-badge";

interface FamilyCollectSectionProps {
  academicYear: string;
  monthKey: string;
  onPayFamily: (family: FamilyFeeRow) => void;
}

/**
 * Finds every active sibling under one parent, regardless of which classes
 * they're actually in — the by-class Collect Fees screen has no way to
 * surface that a family spans several classes, so a school paying for a
 * whole family at once had no single place to search or settle it from.
 */
export function FamilyCollectSection({
  academicYear,
  monthKey,
  onPayFamily,
}: FamilyCollectSectionProps) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const studentsState = useStudentsState();
  const feesState = useFeesState();
  useEffect(() => setMounted(true), []);

  const families = useMemo(
    () =>
      mounted
        ? listFamilies({ academicYear, monthKey, search: applied || undefined })
        : [],
    [mounted, academicYear, monthKey, applied, studentsState, feesState],
  );

  function applyFilter() {
    setApplied(search);
  }

  function resetFilter() {
    setSearch("");
    setApplied("");
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-primary" />
          {t("feesFamilyCollectSection.collectByFamily")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("feesFamilyCollectSection.searchByParentNamePhoneOrAny")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-b bg-secondary/20 px-5 py-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("feesFamilyCollectSection.searchParentOrStudent")}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder={t("feesFamilyCollectSection.parentNamePhoneOrStudentName")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            />
          </div>
        </div>
        <Button onClick={applyFilter}>{t("feesCollectFeesSection.search")}</Button>
        <Button variant="outline" onClick={resetFilter}>
          {t("feesCollectFeesSection.reset")}
        </Button>
      </div>

      <div className="divide-y">
        {mounted && families.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {applied
              ? t("feesFamilyCollectSection.noFamilyMatchesThatSearch")
              : t("feesFamilyCollectSection.typeAParentOrStudentNameTo")}
          </p>
        )}
        {families.map((f) => {
          const isOpen = expanded === f.parentId;
          return (
            <div key={f.parentId}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-start hover:bg-secondary/30"
                onClick={() => setExpanded(isOpen ? null : f.parentId)}
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {f.parentName}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      ({f.parentCode})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.parentPhone} · {f.children.length}{" "}
                    {f.children.length === 1
                      ? t("feesFamilyCollectSection.child")
                      : t("feesFamilyCollectSection.children")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-end">
                    <p className="text-xs text-muted-foreground">
                      {t("feesFamilyCollectSection.totalOutstanding")}
                    </p>
                    <p
                      className={`font-semibold tabular-nums ${f.totalOutstanding > 0 ? "text-rose-600" : ""}`}
                    >
                      {money(f.totalOutstanding)}
                    </p>
                  </div>
                  {f.totalOutstanding > 0 && (
                    <Button
                      className="h-8 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPayFamily(f);
                      }}
                    >
                      {t("feesFamilyCollectSection.payFamily")}
                    </Button>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="overflow-x-auto bg-secondary/10 px-5 pb-4">
                  <table className="w-full text-sm">
                    <thead className="text-start text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">{t("feesFamilyPaymentDialog.student")}</th>
                        <th className="px-3 py-2 font-medium">{t("feesFamilyPaymentDialog.class")}</th>
                        <th className="px-3 py-2 font-medium">{t("feesCollectFeesSection.status")}</th>
                        <th className="px-3 py-2 text-end font-medium">
                          {t("feesFamilyPaymentDialog.outstanding")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.children.map((c) => (
                        <tr key={c.studentId} className="border-t">
                          <td className="px-3 py-2 font-medium">{c.fullName}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.className}
                            {c.section !== "—" ? ` — ${c.section}` : ""}
                          </td>
                          <td className="px-3 py-2">
                            <FeeStatusBadge status={c.status} />
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            {money(c.outstandingBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
