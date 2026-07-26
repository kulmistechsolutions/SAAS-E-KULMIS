"use client";


import { useT } from "@/lib/i18n/provider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ApiResultsClassOverview } from "@/lib/examinations/api";

export function ResultsClassTable({
  rows,
  academicYear,
}: {
  rows: ApiResultsClassOverview[];
  academicYear?: string;
}) {
  const t = useT();
  const suffix = academicYear
    ? `?year=${encodeURIComponent(academicYear)}`
    : "";

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("examinationsResultsClassTable.class")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsResultsClassTable.sections")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsResultsClassTable.students")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsResultsClassTable.published")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsResultsClassTable.teacherLock")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsResultsClassTable.studentPortal")}</th>
              <th className="px-4 py-2.5 font-medium">{t("examinationsResultsClassTable.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.classId} className="border-t">
                <td className="px-4 py-2.5 font-medium">{r.className}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.sectionCount}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.studentCount}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={r.published ? "success" : "muted"}>
                    {r.published ? "Yes" : "No"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={r.teacherLocked ? "warning" : "muted"}>
                    {r.teacherLocked ? "Locked" : "Open"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={r.studentPortalOpen ? "success" : "muted"}>
                    {r.studentPortalOpen ? "Open" : "Closed"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Button asChild variant="outline" className="h-8">
                    <Link href={`/examinations/results/${r.classId}${suffix}`}>
                      {t("examinationsResultsClassTable.viewResults")}
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {t("examinationsResultsClassTable.noExaminationResultsForThisAcademic")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
