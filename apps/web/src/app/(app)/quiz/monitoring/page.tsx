"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiQuizMonitoring, type QuizMonitoringResponse } from "@/lib/quiz/api";
import { QuizStatusBadge } from "@/components/quiz/status-badge";
import type { QuizStatus } from "@/lib/quiz/types";
import { toast } from "@/lib/toast";

const STATUS_MAP: Record<string, QuizStatus> = {
  DRAFT: "DRAFT",
  PUBLISHED: "ACTIVE",
  CLOSED: "CLOSED",
  ARCHIVED: "ARCHIVED",
};

export default function QuizMonitoringPage() {
  const [data, setData] = useState<QuizMonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiQuizMonitoring()
      .then(setData)
      .catch(() => toast("Failed to load quiz monitoring", "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">Loading teacher quiz monitoring…</p>;
  }

  if (!data) {
    return <p className="text-muted-foreground">Could not load monitoring data.</p>;
  }

  const { summary, quizzes } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teacher Quiz Monitoring</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor all teacher-created online quizzes. This view is separate from official school examinations.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total Quizzes", value: summary.totalQuizzes },
          { label: "Published", value: summary.published },
          { label: "Draft", value: summary.draft },
          { label: "Closed", value: summary.closed },
          { label: "Total Attempts", value: summary.totalAttempts },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Teacher</th>
              <th className="px-4 py-3 font-medium">Quiz</th>
              <th className="px-4 py-3 font-medium">Class / Section</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Attempts</th>
              <th className="px-4 py-3 font-medium">Avg Score</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {quizzes.map((q) => (
              <tr key={q.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">{q.teacherName}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{q.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{q.code}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {q.className}
                  {q.section ? ` · ${q.section}` : ""}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{q.subject ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{q.attemptCount}</td>
                <td className="px-4 py-3 tabular-nums">{q.averageScore}%</td>
                <td className="px-4 py-3">
                  <QuizStatusBadge status={STATUS_MAP[q.status] ?? "DRAFT"} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/quiz/${q.id}`} className="text-primary hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
