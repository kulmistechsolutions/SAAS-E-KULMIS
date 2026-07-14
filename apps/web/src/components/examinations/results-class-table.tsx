"use client";

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
  const suffix = academicYear
    ? `?year=${encodeURIComponent(academicYear)}`
    : "";

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-4 py-2.5 font-medium">Class</th>
              <th className="px-4 py-2.5 font-medium">Sections</th>
              <th className="px-4 py-2.5 font-medium">Students</th>
              <th className="px-4 py-2.5 font-medium">Published</th>
              <th className="px-4 py-2.5 font-medium">Teacher Lock</th>
              <th className="px-4 py-2.5 font-medium">Student Portal</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
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
                      View Results
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No examination results for this academic year.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
