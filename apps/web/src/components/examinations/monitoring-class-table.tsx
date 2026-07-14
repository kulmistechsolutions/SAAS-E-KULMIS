"use client";

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
              <th className="px-4 py-2.5 font-medium">Class</th>
              <th className="px-4 py-2.5 font-medium">Sections</th>
              <th className="px-4 py-2.5 font-medium">Students</th>
              <th className="px-4 py-2.5 font-medium">Subjects</th>
              <th className="px-4 py-2.5 font-medium">Submitted</th>
              <th className="px-4 py-2.5 font-medium">Pending</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
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
                      View
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No classes with active examinations to monitor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
