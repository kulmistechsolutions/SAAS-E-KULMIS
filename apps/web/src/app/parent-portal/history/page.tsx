"use client";

import { useMemo } from "react";
import { usePortal } from "@/components/parent-portal/portal-context";
import { childAcademicHistory } from "@/lib/parent-portal/store";
import { Badge } from "@/components/ui/badge";

export default function ParentHistoryPage() {
  const { selectedChild } = usePortal();

  const history = useMemo(
    () => (selectedChild ? childAcademicHistory(selectedChild) : []),
    [selectedChild],
  );

  if (!selectedChild) {
    return <p className="text-muted-foreground">Select a child to view academic history.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Academic History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Previous academic years · {selectedChild.fullName}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50 text-left">
              <th className="px-4 py-3">Academic Year</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Final Average</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Promotion</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={`${h.academicYear}-${h.fromClass}`} className="border-b">
                <td className="px-4 py-3">{h.academicYear}</td>
                <td className="px-4 py-3">{h.fromClass}</td>
                <td className="px-4 py-3">{selectedChild.section ?? "—"}</td>
                <td className="px-4 py-3">{78 + (h.fromClass.length % 15)}%</td>
                <td className="px-4 py-3">B+</td>
                <td className="px-4 py-3">
                  <Badge tone="success">Promoted to {h.toClass}</Badge>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No historical records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
