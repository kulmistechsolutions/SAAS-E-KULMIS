"use client";

import { Suspense, use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  apiQuizByCode,
  apiSubmitQuizAttempt,
  apiVerifyQuizAccess,
  type QuizAccessResponse,
} from "@/lib/quiz/api";
import { formatDuration } from "@/lib/quiz/format";
import { toast } from "@/lib/toast";

type PublicQuestion = {
  id: string;
  question: string;
  questionType?: string;
  options?: string[];
  matchLeft?: string[];
  matchChoices?: string[];
  blankCount?: number;
  marks: number;
};

type PublicQuiz = {
  title: string;
  code: string;
  description: string | null;
  instructions: string | null;
  timeLimitMin: number | null;
  showResultsImmediately: boolean;
  disableCopyPaste: boolean;
  preventMinimize: boolean;
  resetOnMinimize: boolean;
  className: string;
  section: string | null;
  subject: string | null;
  questions: PublicQuestion[];
};

function TakeQuizContent({ code }: { code: string }) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"login" | "instructions" | "quiz" | "done">("login");
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [access, setAccess] = useState<QuizAccessResponse | null>(null);
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number | null; pct: number | null; pending?: boolean } | null>(null);
  const [violations, setViolations] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (step !== "quiz" || submitted || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [step, submitted, secondsLeft]);

  // ── Anti-cheat: react to the student leaving the exam tab/window ──
  useEffect(() => {
    if (step !== "quiz" || submitted || !quiz) return;
    if (!quiz.preventMinimize && !quiz.resetOnMinimize) return;

    const onLeave = () => {
      if (document.visibilityState !== "hidden") return;
      setViolations((v) => v + 1);
      if (quiz.resetOnMinimize) {
        // Wipe every answer so the student must start over from the beginning.
        setAnswers({});
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", onLeave);
    window.addEventListener("blur", onLeave);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [step, submitted, quiz]);

  // ── Anti-cheat: block copy / cut / paste / context menu during the exam ──
  useEffect(() => {
    if (step !== "quiz" || submitted || !quiz?.disableCopyPaste) return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("contextmenu", block);
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("contextmenu", block);
    };
  }, [step, submitted, quiz]);

  useEffect(() => {
    if (secondsLeft === 0 && step === "quiz" && !submitted && quiz && access) {
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiVerifyQuizAccess({
        quizCode: code,
        studentCode: studentCode.trim(),
        password,
      });
      setAccess(res);
      setStep("instructions");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Access denied", "error");
    } finally {
      setLoading(false);
    }
  }

  async function startQuiz() {
    setLoading(true);
    try {
      const row = await apiQuizByCode(code);
      const mapped: PublicQuiz = {
        title: row.title,
        code: row.code,
        description: row.description,
        instructions: row.instructions ?? null,
        timeLimitMin: row.timeLimitMin,
        showResultsImmediately: row.showResultsImmediately ?? true,
        disableCopyPaste: !!row.disableCopyPaste,
        preventMinimize: !!row.preventMinimize,
        resetOnMinimize: !!row.resetOnMinimize,
        className: row.class?.name ?? "",
        section: row.section?.name ?? null,
        subject: row.subject?.name ?? null,
        questions: (row.questions ?? []).map((q) => ({
          id: q.id,
          question: q.question,
          questionType: q.questionType,
          options: Array.isArray(q.options) ? (q.options as string[]) : [],
          matchLeft: q.matchLeft,
          matchChoices: q.matchChoices,
          blankCount: q.blankCount,
          marks: q.marks,
        })),
      };
      setQuiz(mapped);
      setSecondsLeft((mapped.timeLimitMin ?? 30) * 60);
      setStep("quiz");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not load quiz", "error");
    } finally {
      setLoading(false);
    }
  }

  function selectOption(questionId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  // MATCH/FILL answers are stored as a JSON array string, one slot per sub-part.
  function readArr(questionId: string, len: number): string[] {
    let arr: string[] = [];
    try {
      const p = JSON.parse(answers[questionId] ?? "");
      if (Array.isArray(p)) arr = p.map((x) => String(x ?? ""));
    } catch {
      /* empty */
    }
    while (arr.length < len) arr.push("");
    return arr;
  }

  function setArrAt(questionId: string, index: number, value: string, len: number) {
    const arr = readArr(questionId, len);
    arr[index] = value;
    setAnswers((prev) => ({ ...prev, [questionId]: JSON.stringify(arr) }));
  }

  async function handleSubmit() {
    if (!quiz || !access || submitted) return;
    const payload = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));
    for (const q of quiz.questions) {
      if (
        (q.questionType === "ESSAY" || q.questionType === "SHORT_ANSWER") &&
        !answers[q.id]?.trim()
      ) {
        toast(`Please answer: ${q.question.slice(0, 40)}…`, "error");
        return;
      }
    }
    try {
      const res = await apiSubmitQuizAttempt({
        quizCode: quiz.code,
        studentId: access.studentId,
        answers: payload,
      });
      setSubmitted(true);
      setStep("done");
      setResult({
        score: res.score,
        pct: res.percentage,
        pending: res.status === "PENDING_REVIEW",
      });
      toast("Quiz submitted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Submit failed", "error");
    }
  }

  if (!mounted) {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center p-8 text-muted-foreground"
        suppressHydrationWarning
      >
        Loading quiz…
      </div>
    );
  }

  if (step === "login") {
    return (
      <div className="mx-auto max-w-md space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Online Quiz</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your Student ID and password to begin.
          </p>
        </div>
        <form onSubmit={(e) => void handleLogin(e)} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div>
            <Label htmlFor="studentCode">Student ID</Label>
            <Input
              id="studentCode"
              className="mt-1.5"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="e.g. SHMM000001"
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="quizPassword">Password</Label>
            <Input
              id="quizPassword"
              type="password"
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying…" : "Continue"}
          </Button>
        </form>
      </div>
    );
  }

  if (step === "instructions" && access) {
    return (
      <div className="mx-auto max-w-lg space-y-6 p-8">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-bold">{access.quiz.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {access.quiz.className}
            {access.quiz.section ? ` · ${access.quiz.section}` : ""}
            {access.quiz.subject ? ` · ${access.quiz.subject}` : ""}
          </p>
          <p className="mt-4 text-sm">Welcome, {access.studentName}.</p>
          {access.quiz.description && (
            <p className="mt-3 text-sm text-muted-foreground">{access.quiz.description}</p>
          )}
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            <li>Duration: {access.quiz.timeLimitMin ?? 30} minutes</li>
            <li>Remaining attempts: {access.remainingAttempts}</li>
          </ul>
          <Button className="mt-6 w-full" onClick={() => void startQuiz()} disabled={loading}>
            {loading ? "Loading…" : "Start Quiz"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Quiz Submitted</h1>
        {result?.pending ? (
          <p className="text-muted-foreground">
            Some answers require teacher review. Results will be available after grading.
          </p>
        ) : access?.quiz.showResultsImmediately && result && result.score !== null ? (
          <p className="text-3xl font-bold text-primary">
            {result.score} pts ({result.pct}%)
          </p>
        ) : (
          <p className="text-muted-foreground">Results will be published by your teacher.</p>
        )}
      </div>
    );
  }

  if (!quiz || !access) {
    return <p className="p-8 text-muted-foreground">Loading quiz…</p>;
  }

  const durationSec = (quiz.timeLimitMin ?? 30) * 60;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {violations > 0 && (
        <div className="rounded-xl border border-rose-400 bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <strong>Warning ({violations}):</strong> You left the exam window.
          {quiz.resetOnMinimize ? " Your answers were cleared — start again from the first question." : " Leaving the exam is not allowed."}
        </div>
      )}
      {(quiz.preventMinimize || quiz.resetOnMinimize || quiz.disableCopyPaste) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          🔒 Exam mode: do not leave this tab
          {quiz.resetOnMinimize ? " (leaving clears your answers)" : ""}
          {quiz.disableCopyPaste ? " · copy & paste are disabled" : ""}.
        </div>
      )}
      <div className="sticky top-0 z-10 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{quiz.title}</h1>
            <p className="text-sm text-muted-foreground">
              {quiz.subject ?? "Quiz"} · {quiz.timeLimitMin ?? 30} minutes
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Time remaining</p>
            <p className="text-2xl font-bold tabular-nums text-rose-600">
              {formatDuration(Math.max(0, secondsLeft))}
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(secondsLeft / durationSec) * 100}%` }}
          />
        </div>
      </div>

      {quiz.questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Question {i + 1} · {q.marks} marks
          </p>
          <p className="mt-2 whitespace-pre-wrap font-medium">{q.question}</p>

          {q.questionType === "MCQ" ? (
            <div className="mt-4 space-y-2">
              {(q.options ?? []).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => selectOption(q.id, opt)}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${answers[q.id] === opt ? "border-primary bg-primary/10" : "hover:bg-secondary"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : q.questionType === "MATCH" ? (
            <div className="mt-4 space-y-2">
              {(q.matchLeft ?? []).map((left, li) => (
                <div key={li} className="flex items-center gap-3">
                  <span className="min-w-[7rem] flex-1 rounded-lg border bg-secondary/40 px-3 py-2 text-sm">{left}</span>
                  <span className="text-muted-foreground">↔</span>
                  <select
                    className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                    value={readArr(q.id, (q.matchLeft ?? []).length)[li] ?? ""}
                    onChange={(e) => setArrAt(q.id, li, e.target.value, (q.matchLeft ?? []).length)}
                  >
                    <option value="">Select…</option>
                    {(q.matchChoices ?? []).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : q.questionType === "FILL_BLANK" ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: q.blankCount ?? 1 }).map((_, bi) => (
                <div key={bi} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Blank {bi + 1}</span>
                  <Input
                    value={readArr(q.id, q.blankCount ?? 1)[bi] ?? ""}
                    onChange={(e) => setArrAt(q.id, bi, e.target.value, q.blankCount ?? 1)}
                    placeholder={`Answer ${bi + 1}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* DIRECT + legacy ESSAY/SHORT_ANSWER */
            <Textarea
              className="mt-4"
              rows={4}
              value={answers[q.id] ?? ""}
              onChange={(e) => selectOption(q.id, e.target.value)}
              placeholder="Type your answer…"
            />
          )}
        </div>
      ))}

      <Button className="w-full" onClick={() => void handleSubmit()}>
        Submit Quiz
      </Button>
    </div>
  );
}

export default function TakeQuizPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading quiz…
        </div>
      }
    >
      <TakeQuizContent code={code} />
    </Suspense>
  );
}
