"use client";


import { useT } from "@/lib/i18n/provider";
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
  const t = useT();
  const [data, setData] = useState<QuizMonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiQuizMonitoring()
      .then(setData)
      .catch(() => toast("Failed to load quiz monitoring", "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">{t("quizMonitoring.loadingTeacherQuizMonitoring")}</p>;
  }

  if (!data) {
    return <p className="text-muted-foreground">{t("quizMonitoring.couldNotLoadMonitoringData")}</p>;
  }

  const { summary, quizzes } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("quizMonitoring.teacherQuizMonitoring")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("quizMonitoring.monitorAllTeacherCreatedOnlineQuizzes")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: t("quizMonitoring.totalQuizzes"), value: summary.totalQuizzes },
          { label: t("quizMonitoring.published"), value: summary.published },
          { label: t("quizMonitoring.draft"), value: summary.draft },
          { label: t("quizMonitoring.closed"), value: summary.closed },
          { label: t("quizMonitoring.totalAttempts"), value: summary.totalAttempts },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b bg-muted/40 text-start">
            <tr>
              <th className="px-4 py-3 font-medium">{t("quizMonitoring.teacher")}</th>
              <th className="px-4 py-3 font-medium">{t("quizMonitoring.quiz")}</th>
              <th className="px-4 py-3 font-medium">{t("quizMonitoring.classSection")}</th>
              <th className="px-4 py-3 font-medium">{t("quizMonitoring.subject")}</th>
              <th className="px-4 py-3 font-medium">{t("quizMonitoring.attempts")}</th>
              <th className="px-4 py-3 font-medium">{t("quizMonitoring.avgScore")}</th>
              <th className="px-4 py-3 font-medium">{t("quizMonitoring.status")}</th>
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
                <td className="px-4 py-3 text-end">
                  <Link href={`/quiz/${q.id}`} className="text-primary hover:underline">
                    {t("quizMonitoring.view")}
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
