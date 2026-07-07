"use client";

import { useMemo } from "react";
import { usePortal } from "@/components/parent-portal/portal-context";
import { childQuizRows } from "@/lib/parent-portal/store";
import { QuizStatusBadge } from "@/components/quiz/status-badge";
import { Badge } from "@/components/ui/badge";

export default function ParentQuizzesPage() {
  const { selectedChild } = usePortal();

  const data = useMemo(
    () => (selectedChild ? childQuizRows(selectedChild.id) : null),
    [selectedChild],
  );

  if (!selectedChild) {
    return <p className="text-muted-foreground">Select a child to view quizzes.</p>;
  }

  const active = data?.assigned.filter((q) => q.status === "ACTIVE") ?? [];
  const upcoming = data?.assigned.filter((q) => q.status === "SCHEDULED") ?? [];
  const completed = data?.history ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Online Quizzes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View-only · {selectedChild.fullName} · Parents cannot attempt quizzes
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Active Quizzes ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active quizzes.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((q) => (
              <div key={q.quizId} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{q.title}</p>
                    <p className="text-sm text-muted-foreground">{q.subject}</p>
                  </div>
                  <QuizStatusBadge status={q.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Assigned / Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming quizzes.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((q) => (
              <div key={q.quizId} className="rounded-xl border bg-card p-4">
                <p className="font-medium">{q.title}</p>
                <p className="text-sm text-muted-foreground">{q.subject}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Quiz History</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50 text-left">
                <th className="px-4 py-3">Quiz</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">%</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {completed.map((h, i) => (
                <tr key={`${h.name}-${h.date}-${i}`} className="border-b">
                  <td className="px-4 py-3">{h.name}</td>
                  <td className="px-4 py-3">{h.subject}</td>
                  <td className="px-4 py-3">{h.score}/{h.total}</td>
                  <td className="px-4 py-3">{h.percentage}%</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3">
                    <Badge tone={h.status === "PASSED" ? "success" : h.status === "FAILED" ? "danger" : "muted"}>
                      {h.status === "PASSED" ? "Pass" : h.status === "FAILED" ? "Fail" : "Pending"}
                    </Badge>
                  </td>
                </tr>
              ))}
              {completed.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No completed quizzes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
