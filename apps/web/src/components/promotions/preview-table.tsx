"use client";

import { AlertTriangle } from "lucide-react";
import { EligibilityBadge } from "./badges";
import { money } from "@/lib/promotions/format";
import type { PromotionCandidate } from "@/lib/promotions/types";

interface Props {
  candidates: PromotionCandidate[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
}

export function PreviewTable({
  candidates,
  selectable = false,
  selected,
  onToggle,
  onToggleAll,
}: Props) {
  const selectableIds = candidates.filter((c) => c.eligible).map((c) => c.studentId);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected?.has(id));

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="max-h-[440px] overflow-auto scrollbar-slim">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {selectable && (
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onToggleAll?.(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-medium">Student ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Current Class</th>
              <th className="px-4 py-3 font-medium">Fees</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={selectable ? 7 : 6} className="px-4 py-12 text-center text-muted-foreground">
                  No students found for this selection.
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c.studentId} className="border-t hover:bg-secondary/40">
                  {selectable && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        disabled={!c.eligible}
                        checked={selected?.has(c.studentId) ?? false}
                        onChange={() => onToggle?.(c.studentId)}
                        className="h-4 w-4 rounded border-input disabled:opacity-40"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-xs">{c.studentCode}</td>
                  <td className="px-4 py-3 font-medium">{c.studentName}</td>
                  <td className="px-4 py-3">
                    {c.currentClass}
                    {c.currentSection ? ` — ${c.currentSection}` : ""}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.outstandingFees > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">{money(c.outstandingFees)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <EligibilityBadge candidate={c} />
                  </td>
                  <td className="px-4 py-3">
                    {c.issues.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Ready</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {c.issues.map((i) => i.label).join(", ")}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
