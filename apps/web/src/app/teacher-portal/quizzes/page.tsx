"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiListQuizzes, apiQuizDashboard } from "@/lib/quiz/api";
import { useTeacherPortal } from "@/components/teacher-portal/portal-context";
import { QuizStatusBadge } from "@/components/quiz/status-badge";
import type { QuizStatus } from "@/lib/quiz/types";

export default function TeacherPortalQuizzesPage() {
  const { teacher } = useTeacherPortal();
  const [quizzes, setQuizzes] = useState<
    {
      id: string;
      title: string;
      code: string;
      status: string;
      class?: { name: string };
      section?: { name: string | null };
      subject?: { name: string | null };
      _count?: { attempts: number };
    }[]
  >([]);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    activeQuizzes: 0,
    draftQuizzes: 0,
    completedQuizzes: 0,
    totalAttempts: 0,
    averageScore: 0,
    pendingReviews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([apiListQuizzes(), apiQuizDashboard()])
      .then(([rows, dashboard]) => {
        setQuizzes(
          rows.filter((q) => q.teacherId === teacher.id) as typeof quizzes,
        );
        setStats(dashboard);
      })
      .catch(() => setQuizzes([]))
      .finally(() => setLoading(false));
  }, [teacher.id]);

  const statusMap: Record<string, QuizStatus> = {
    DRAFT: "DRAFT",
    PUBLISHED: "ACTIVE",
    CLOSED: "CLOSED",
    ARCHIVED: "ARCHIVED",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Quizzes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Instructional online quizzes for your assigned classes — separate from official school examinations.
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher-portal/quizzes/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Quiz
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Quizzes", value: stats.totalQuizzes },
          { label: "Active", value: stats.activeQuizzes },
          { label: "Drafts", value: stats.draftQuizzes },
          { label: "Completed", value: stats.completedQuizzes },
          { label: "Student Attempts", value: stats.totalAttempts },
          { label: "Average Score", value: `${stats.averageScore}%` },
          { label: "Pending Reviews", value: stats.pendingReviews },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading quizzes…</p>
      ) : quizzes.length === 0 ? (
        <p className="text-muted-foreground">No quizzes yet. Create your first quiz for an assigned class.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Quiz</th>
                <th className="px-4 py-3 font-medium">Class / Section</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {quizzes.map((q) => (
                <tr key={q.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{q.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{q.code}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {q.class?.name ?? "—"}
                    {q.section?.name ? ` · ${q.section.name}` : ""}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{q.subject?.name ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{q._count?.attempts ?? 0}</td>
                  <td className="px-4 py-3">
                    <QuizStatusBadge status={statusMap[q.status] ?? "DRAFT"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/teacher-portal/quizzes/${q.id}`} className="text-primary hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
