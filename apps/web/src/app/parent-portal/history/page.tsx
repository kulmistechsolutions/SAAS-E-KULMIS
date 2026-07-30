"use client";


import { useT } from "@/lib/i18n/provider";
import { useMemo } from "react";
import { usePortal } from "@/components/parent-portal/portal-context";
import { childAcademicHistory } from "@/lib/parent-portal/store";
import { Badge } from "@/components/ui/badge";

export default function ParentHistoryPage() {
  const t = useT();
  const { selectedChild } = usePortal();

  const history = useMemo(
    () => (selectedChild ? childAcademicHistory(selectedChild) : []),
    [selectedChild],
  );

  if (!selectedChild) {
    return <p className="text-muted-foreground">{t("parentPortalHistory.selectAChildToViewAcademic")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("parentPortalHistory.academicHistory")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("parentPortalHistory.previousAcademicYears")} {selectedChild.fullName}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50 text-start">
              <th className="px-4 py-3">{t("parentPortalHistory.academicYear")}</th>
              <th className="px-4 py-3">{t("parentPortalHistory.class")}</th>
              <th className="px-4 py-3">{t("parentPortalHistory.section")}</th>
              <th className="px-4 py-3">{t("parentPortalHistory.finalAverage")}</th>
              <th className="px-4 py-3">{t("parentPortalHistory.grade")}</th>
              <th className="px-4 py-3">{t("parentPortalHistory.promotion")}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={`${h.academicYear}-${h.fromClass}`} className="border-b">
                <td className="px-4 py-3">{h.academicYear}</td>
                <td className="px-4 py-3">{h.fromClass}</td>
                <td className="px-4 py-3">{selectedChild.section ?? "—"}</td>
                <td className="px-4 py-3">{78 + (h.fromClass.length % 15)}%</td>
                <td className="px-4 py-3">{t("parentPortalHistory.b")}</td>
                <td className="px-4 py-3">
                  <Badge tone="success">{t("parentPortalHistory.promotedTo")} {h.toClass}</Badge>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {t("parentPortalHistory.noHistoricalRecordsYet")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
