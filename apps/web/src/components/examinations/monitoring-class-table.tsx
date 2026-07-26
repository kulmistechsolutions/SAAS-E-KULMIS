"use client";


import { useT } from "@/lib/i18n/provider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ApiMonitoringClassOverview } from "@/lib/examinations/api";

export function MonitoringClassTable({
  rows,
  examId,
  academicYear,
}: {
  rows: ApiMonitoringClassOverview[];
  examId?: string;
  academicYear?: string;
}) {
  const t = useT();
  const qs = new URLSearchParams();
  if (examId) qs.set("examId", examId);
  if (academicYear) qs.set("year", academicYear);
  const suffix = qs.toString() ? `?${qs}` : "";

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoringClassTable.class")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoringClassTable.sections")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoringClassTable.students")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoringClassTable.subjects")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoringClassTable.submitted")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoringClassTable.pending")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoringClassTable.status")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoringClassTable.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.classId} className="border-t">
                <td className="px-4 py-2.5 font-medium">{r.className}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.sectionCount}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.studentCount}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.subjectCount}</td>
                <td className="px-4 py-2.5 tabular-nums text-emerald-600">{r.submitted}</td>
                <td className="px-4 py-2.5 tabular-nums text-amber-600">{r.pending}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={r.status === "Complete" ? "success" : "warning"}>
                    {r.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Button asChild variant="outline" className="h-8">
                    <Link href={`/examinations/monitoring/${r.classId}${suffix}`}>
                      {t("examinationsMonitoringClassTable.view")}
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  {t("examinationsMonitoringClassTable.noClassesWithActiveExaminationsTo")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
