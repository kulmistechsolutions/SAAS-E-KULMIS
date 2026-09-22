"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/quiz/rich-text";
import { QuizText } from "@/components/quiz/rtl-text";
import {
  apiGradeQuizAnswer,
  apiQuizAttemptResultStaff,
  type QuizAttemptReview,
} from "@/lib/quiz/api";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * One student's answers, with the marks a teacher may change.
 *
 * The system marks written True / False by the words it knows. A student who
 * writes "T" is marked wrong, and whether that should stand is a teacher's
 * call — so each answer can be marked right or wrong here. Every change goes
 * to the school's audit log with the mark before and after and the reason,
 * because it is a change to an academic record.
 */
export function AttemptMarksDialog({
  attemptId,
  onClose,
  onChanged,
}: {
  attemptId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const [review, setReview] = useState<QuizAttemptReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!attemptId) return;
    let live = true;
    setLoading(true);
    setReview(null);
    setReason("");
    apiQuizAttemptResultStaff(attemptId)
      .then((r) => live && setReview(r))
      .catch((e) => toast(e instanceof Error ? e.message : "Could not load answers", "error"))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [attemptId]);

  async function setMarks(answerId: string, marks: number) {
    if (!attemptId) return;
    setBusy(answerId);
    try {
      await apiGradeQuizAnswer(attemptId, answerId, marks, reason.trim() || undefined);
      setReview(await apiQuizAttemptResultStaff(attemptId));
      toast(t("quizOverride.saved"), "success");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not change the mark", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={!!attemptId}
      onClose={onClose}
      title={
        review
          ? `${review.student.name} · ${review.marksObtained} / ${review.totalMarks}`
          : t("quizOverride.title")
      }
      className="max-w-3xl"
    >
      {loading || !review ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("quizOverride.reason")}
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder={t("quizOverride.reasonHint")}
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{t("quizOverride.audited")}</p>
          </div>

          <ol className="max-h-[60vh] space-y-2 overflow-y-auto">
            {review.questions.map((q) => {
              const full = q.marksAwarded === q.maxMarks && q.maxMarks > 0;
              return (
                <li key={q.questionId} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-1.5 font-medium">
                      <span className="shrink-0 tabular-nums">{q.number}.</span>
                      <RichText
                        as="p"
                        text={q.question}
                        html={q.questionHtml}
                        direction={q.direction}
                        quizDirection={review.quiz.direction}
                      />
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                        q.status === "CORRECT"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : q.status === "INCORRECT"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                            : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {q.marksAwarded} / {q.maxMarks}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md bg-secondary/40 px-2.5 py-1.5">
                      <p className="text-[11px] text-muted-foreground">{t("quizTake.yourAnswer")}</p>
                      <QuizText
                        as="p"
                        text={q.studentAnswer || "—"}
                        direction={q.direction}
                        quizDirection={review.quiz.direction}
                      />
                    </div>
                    <div className="rounded-md bg-emerald-50/60 px-2.5 py-1.5 dark:bg-emerald-950/20">
                      <p className="text-[11px] text-muted-foreground">{t("quizTake.correctAnswer")}</p>
                      <QuizText
                        as="p"
                        text={q.correctAnswer || "—"}
                        direction={q.direction}
                        quizDirection={review.quiz.direction}
                      />
                    </div>
                  </div>
                  {q.answerId && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={busy === q.answerId || full}
                        onClick={() => void setMarks(q.answerId!, q.maxMarks)}
                      >
                        <Check className="me-1 h-3.5 w-3.5 text-emerald-600" />
                        {t("quizOverride.markCorrect")}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={busy === q.answerId || q.marksAwarded === 0}
                        onClick={() => void setMarks(q.answerId!, 0)}
                      >
                        <X className="me-1 h-3.5 w-3.5 text-rose-600" />
                        {t("quizOverride.markIncorrect")}
                      </Button>
                      {busy === q.answerId && (
                        <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Dialog>
  );
}
