"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ExamSummaryCards } from "@/components/examinations/summary-cards";
import {
  ExamQuickActions,
  MonitoringTable,
  RecentExamsList,
} from "@/components/examinations/widgets";
import { ExamStatusBadge } from "@/components/examinations/exam-status-badge";
import { examTypeLabel, shortDate } from "@/lib/examinations/format";
import {
  dashboardSummary,
  monitoringRows,
  recentExams,
  useExaminationsState,
} from "@/lib/examinations/store";

export default function ExaminationsDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const exams = useExaminationsState();

  useEffect(() => setMounted(true), []);

  const summary = useMemo(
    () => (mounted ? dashboardSummary() : null),
    [mounted, exams],
  );
  const monitoring = useMemo(
    () => (mounted ? monitoringRows() : []),
    [mounted, exams],
  );
  const recent = useMemo(
    () => (mounted ? recentExams(6) : []),
    [mounted, exams],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Examination Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete examination lifecycle — creation, marking, results, and publishing.
          </p>
        </div>
        <Link
          href="/examinations/create"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Exam
        </Link>
      </div>

      {summary && <ExamSummaryCards summary={summary} />}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {mounted && <MonitoringTable rows={monitoring.slice(0, 12)} />}
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">All Examinations</h2>
              <Link href="/examinations/monitoring" className="text-sm text-primary hover:underline">
                View monitoring
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Exam</th>
                    <th className="px-4 py-2.5 font-medium">Class-Section</th>
                    <th className="px-4 py-2.5 font-medium">Term</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Weight</th>
                    <th className="px-4 py-2.5 font-medium">Period</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.exams.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="px-4 py-2.5">
                        <Link href={`/examinations/marks?exam=${e.id}`} className="font-medium text-primary hover:underline">
                          {e.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {e.className} — {e.section}
                      </td>
                      <td className="px-4 py-2.5">{e.term}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{examTypeLabel(e.examType)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{e.weightPercent}%</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {shortDate(e.startDate)} — {shortDate(e.endDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <ExamStatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          {mounted && <RecentExamsList exams={recent} />}
          <ExamQuickActions />
        </div>
      </div>
    </div>
  );
}
