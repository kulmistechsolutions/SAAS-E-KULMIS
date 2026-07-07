"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getQuiz, saveAnswer, startAttempt, submitAttempt } from "@/lib/quiz/store";
import { formatDuration } from "@/lib/quiz/format";
import { toast } from "@/lib/toast";

export default function TakeQuizPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const search = useSearchParams();
  const studentId = search.get("student") ?? "";
  const quiz = useMemo(() => getQuiz(code), [code]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number | null; pct: number | null } | null>(null);

  useEffect(() => {
    if (!quiz || !studentId || started) return;
    const res = startAttempt(quiz.id, studentId);
    if (!res.ok) {
      toast(res.error ?? "Cannot start", "error");
      return;
    }
    setAttemptId(res.attempt!.id);
    setSecondsLeft(quiz.durationMinutes * 60);
    setStarted(true);
  }, [quiz, studentId, started]);

  useEffect(() => {
    if (!started || submitted || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [started, submitted, secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0 && started && !submitted && attemptId) handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  function selectOption(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    if (!attemptId) return;
    const q = quiz?.questions.find((x) => x.id === questionId);
    if (q?.type === "TRUE_FALSE") {
      saveAnswer(attemptId, { questionId, booleanAnswer: optionId === "true" });
    } else {
      saveAnswer(attemptId, { questionId, selectedOptionIds: [optionId] });
    }
  }

  function handleSubmit() {
    if (!attemptId) return;
    const res = submitAttempt(attemptId);
    if (!res.ok) {
      toast(res.error ?? "Submit failed", "error");
      return;
    }
    setSubmitted(true);
    setResult({ score: res.attempt?.obtainedMarks ?? null, pct: res.attempt?.percentage ?? null });
    toast("Quiz submitted", "success");
  }

  if (!quiz) return <p className="p-8 text-muted-foreground">Quiz not found.</p>;
  if (!studentId) return <p className="p-8 text-muted-foreground">Select a student from the portal.</p>;

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Quiz Submitted</h1>
        {quiz.showResultImmediately && result && result.score !== null ? (
          <p className="text-3xl font-bold text-primary">{result.score} / {quiz.totalMarks} ({result.pct}%)</p>
        ) : (
          <p className="text-muted-foreground">Results will be published by your teacher.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="sticky top-0 z-10 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{quiz.title}</h1>
            <p className="text-sm text-muted-foreground">{quiz.subject} · {quiz.durationMinutes} minutes</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Time remaining</p>
            <p className="text-2xl font-bold tabular-nums text-rose-600">{formatDuration(Math.max(0, secondsLeft))}</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(secondsLeft / (quiz.durationMinutes * 60)) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Auto-save enabled</p>
      </div>

      {quiz.questions.sort((a, b) => a.order - b.order).map((q, i) => (
        <div key={q.id} className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">Question {i + 1} · {q.marks} marks</p>
          <p className="mt-2 font-medium">{q.text}</p>
          {q.type === "TRUE_FALSE" ? (
            <div className="mt-4 flex gap-2">
              <Button variant={answers[q.id] === "true" ? "default" : "outline"} onClick={() => selectOption(q.id, "true")}>True</Button>
              <Button variant={answers[q.id] === "false" ? "default" : "outline"} onClick={() => selectOption(q.id, "false")}>False</Button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {q.options?.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectOption(q.id, opt.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${answers[q.id] === opt.id ? "border-primary bg-primary/10" : "hover:bg-secondary"}`}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <Button className="w-full" onClick={handleSubmit}>Submit Quiz</Button>
    </div>
  );
}
