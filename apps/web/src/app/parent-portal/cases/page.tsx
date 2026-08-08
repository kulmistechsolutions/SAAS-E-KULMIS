"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { AlertTriangle } from "lucide-react";
import { usePortal, usePortalAudit } from "@/components/parent-portal/portal-context";
import { apiParentChildCases } from "@/lib/student-cases/api";
import type { StudentOwnCase } from "@/lib/student-cases/types";
import { shortDate } from "@/lib/students/format";

export default function ParentCasesPage() {
  const t = useT();
  const { selectedChild } = usePortal();
  usePortalAudit("CASES_VIEWED", selectedChild?.id);

  const [cases, setCases] = useState<StudentOwnCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedChild) {
      setCases([]);
      return;
    }
    setLoading(true);
    void apiParentChildCases(selectedChild.id)
      .then(setCases)
      .finally(() => setLoading(false));
  }, [selectedChild]);

  if (!selectedChild) {
    return (
      <p className="text-muted-foreground">{t("studentCases.selectAChild")}</p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          {t("studentCases.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {selectedChild.fullName} · {selectedChild.className}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 text-center sm:w-64">
        <p className="text-2xl font-bold tabular-nums">{cases.length}</p>
        <p className="text-xs text-muted-foreground">{t("studentCases.totalCases")}</p>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          {t("attendanceStudents.loading")}
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-xl border bg-secondary/20 p-8 text-center text-muted-foreground">
          {t("studentCases.noCasesYet")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50 text-start">
                <th className="px-4 py-3 font-medium">{t("studentCases.date")}</th>
                <th className="px-4 py-3 font-medium">{t("studentCases.caseTitle")}</th>
                <th className="px-4 py-3 font-medium">{t("studentCases.note")}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{shortDate(c.date)}</td>
                  <td className="px-4 py-3 font-medium">{c.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
