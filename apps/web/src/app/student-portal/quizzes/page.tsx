"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import Link from "next/link";
import { ClipboardList, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiStudentPortalQuizzes, type StudentPortalQuizRow } from "@/lib/student-portal/api";

const RESULT_TONE: Record<string, "success" | "danger" | "warning" | "muted"> = {
  PASS: "success",
  FAIL: "danger",
};

export default function StudentPortalQuizzesPage() {
  const t = useT();
  const [rows, setRows] = useState<StudentPortalQuizRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void apiStudentPortalQuizzes()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">{t("studentPortalQuizzes.loadingQuizzes")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("studentPortalQuizzes.quizzes")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("studentPortalQuizzes.quizzesAssignedToYourClass")}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground shadow-sm">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
          {t("studentPortalQuizzes.noQuizzesAssignedYet")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.subject ?? "—"} · {r.teacherName}
                  </p>
                </div>
                <Badge tone={r.status === "PUBLISHED" ? "success" : "muted"}>
                  {r.status === "PUBLISHED"
                    ? t("studentPortalQuizzes.open")
                    : r.status === "CLOSED"
                      ? t("studentPortalQuizzes.closed")
                      : r.status}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {r.questionCount} {t("studentPortalQuizzes.questions")}
                </span>
                {r.timeLimitMin && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {r.timeLimitMin} min
                  </span>
                )}
                <span>
                  {r.attemptsUsed}/{r.maxAttempts} {t("studentPortalQuizzes.attemptsUsed")}
                </span>
              </div>

              {r.lastResult && r.lastResult.score !== null && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border bg-secondary/30 px-3 py-2 text-sm">
                  <span className="font-semibold">
                    {r.lastResult.score} {t("studentPortalQuizzes.marks")}
                  </span>
                  <span className="text-muted-foreground">({r.lastResult.percentage}%)</span>
                  {r.lastResult.result && (
                    <Badge tone={RESULT_TONE[r.lastResult.result] ?? "muted"}>
                      {r.lastResult.result}
                    </Badge>
                  )}
                </div>
              )}
              {r.lastResult && r.lastResult.status === "PENDING_REVIEW" && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {t("studentPortalQuizzes.submittedAwaitingTeacherReview")}
                </p>
              )}

              {r.canAttempt ? (
                <Link href={`/quiz-take/${r.code}`} target="_blank" className="mt-4 inline-block">
                  <Button className="h-9">
                    <Play className="me-2 h-4 w-4" />
                    {r.attemptsUsed > 0
                      ? t("studentPortalQuizzes.retakeQuiz")
                      : t("studentPortalQuizzes.startQuiz")}
                  </Button>
                </Link>
              ) : r.attemptsUsed === 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  {r.status === "CLOSED"
                    ? t("studentPortalQuizzes.thisQuizHasClosed")
                    : r.startAt && new Date(r.startAt) > new Date()
                      ? t("studentPortalQuizzes.notOpenYet")
                      : t("studentPortalQuizzes.notAvailableRightNow")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
