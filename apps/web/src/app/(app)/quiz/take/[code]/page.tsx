"use client";

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Flag,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  apiQuizAttemptReview,
  apiQuizByCode,
  apiQuizLanding,
  apiQuizLinkOpened,
  apiSaveQuizAnswers,
  apiStartQuizAttempt,
  apiSubmitQuizAttempt,
  apiVerifyQuizAccess,
  type QuizAccessResponse,
  type QuizAttemptReview,
  type QuizLandingResponse,
} from "@/lib/quiz/api";
import { formatDuration } from "@/lib/quiz/format";
import { printAttemptReviewPdf } from "@/lib/quiz/print";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

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
  allowReviewAnswers: boolean;
  allowPdfDownload: boolean;
  disableCopyPaste: boolean;
  preventMinimize: boolean;
  resetOnMinimize: boolean;
  className: string;
  section: string | null;
  subject: string | null;
  teacherName: string | null;
  questions: PublicQuestion[];
};

type Step = "landing" | "login" | "instructions" | "quiz" | "done" | "review";

function SchoolHeader({
  schoolName,
  logoUrl,
}: {
  schoolName: string;
  logoUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={schoolName}
          className="h-14 w-14 rounded-xl object-contain ring-1 ring-black/5"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
          {schoolName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div>
        <p className="text-lg font-semibold tracking-tight">{schoolName}</p>
        <p className="text-xs text-muted-foreground">Online Examination</p>
      </div>
    </div>
  );
}

function TakeQuizContent({ code }: { code: string }) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("landing");
  const [landing, setLanding] = useState<QuizLandingResponse | null>(null);
  const [landingError, setLandingError] = useState<string | null>(null);
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [access, setAccess] = useState<QuizAccessResponse | null>(null);
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [result, setResult] = useState<QuizAttemptReview | null>(null);
  const [violations, setViolations] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    void apiQuizLanding(code)
      .then((res) => {
        if (!cancelled) setLanding(res);
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Quiz not available";
          setLandingError(message);
          toast(message, "error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (step !== "quiz" || submitted || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [step, submitted, secondsLeft]);

  useEffect(() => {
    if (step !== "quiz" || submitted || !quiz) return;
    if (!quiz.preventMinimize && !quiz.resetOnMinimize) return;
    const onLeave = () => {
      if (document.visibilityState !== "hidden") return;
      setViolations((v) => v + 1);
      if (quiz.resetOnMinimize) {
        setAnswers({});
        setMarked({});
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

  const persistAnswers = useCallback(async () => {
    if (!attemptId || !access || submitted) return;
    const payload = Object.keys({ ...answers, ...marked }).map((questionId) => ({
      questionId,
      answer: answers[questionId] ?? "",
      markedForReview: !!marked[questionId],
    }));
    // Always include visited questions even if empty
    if (quiz) {
      for (const q of quiz.questions) {
        if (!payload.some((p) => p.questionId === q.id) && (visited[q.id] || answers[q.id])) {
          payload.push({
            questionId: q.id,
            answer: answers[q.id] ?? "",
            markedForReview: !!marked[q.id],
          });
        }
      }
    }
    if (payload.length === 0) return;
    setSaving(true);
    try {
      await apiSaveQuizAnswers({
        attemptId,
        studentId: access.studentId,
        answers: payload,
      });
    } catch {
      /* silent autosave */
    } finally {
      setSaving(false);
    }
  }, [attemptId, access, answers, marked, visited, quiz, submitted]);

  useEffect(() => {
    if (step !== "quiz" || !attemptId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistAnswers(), 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, marked, step, attemptId, persistAnswers]);

  async function handleSubmit() {
    if (!quiz || !access || submitted) return;
    const payload = quiz.questions.map((q) => ({
      questionId: q.id,
      answer: answers[q.id] ?? "",
      markedForReview: !!marked[q.id],
    }));
    try {
      const res = await apiSubmitQuizAttempt({
        quizCode: quiz.code,
        studentId: access.studentId,
        attemptId: attemptId ?? undefined,
        answers: payload,
      });
      setSubmitted(true);
      setStep("done");
      if (res.showResultsImmediately !== false && access.quiz.showResultsImmediately) {
        try {
          const review = await apiQuizAttemptReview(res.id);
          setResult(review);
        } catch {
          setResult(null);
        }
      }
      toast("Quiz submitted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Submit failed", "error");
    }
  }

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
      void apiQuizLinkOpened({
        quizCode: code,
        studentCode: studentCode.trim(),
      }).catch(() => undefined);
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
    if (!access) return;
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
        allowReviewAnswers: row.allowReviewAnswers ?? true,
        allowPdfDownload: row.allowPdfDownload ?? true,
        disableCopyPaste: !!row.disableCopyPaste,
        preventMinimize: !!row.preventMinimize,
        resetOnMinimize: !!row.resetOnMinimize,
        className: row.class?.name ?? access.quiz.className,
        section: row.section?.name ?? access.quiz.section,
        subject: row.subject?.name ?? access.quiz.subject,
        teacherName: row.teacherName ?? access.quiz.teacherName,
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
      const started = await apiStartQuizAttempt({
        quizCode: code,
        studentId: access.studentId,
      });
      setAttemptId(started.attemptId);
      const nextAnswers: Record<string, string> = {};
      const nextMarked: Record<string, boolean> = {};
      for (const a of started.savedAnswers) {
        nextAnswers[a.questionId] = a.answer;
        nextMarked[a.questionId] = a.markedForReview;
      }
      setAnswers(nextAnswers);
      setMarked(nextMarked);
      setQuiz(mapped);
      setSecondsLeft(
        started.secondsLeft ?? (mapped.timeLimitMin ?? 30) * 60,
      );
      setCurrentIdx(0);
      if (mapped.questions[0]) {
        setVisited({ [mapped.questions[0].id]: true });
      }
      setStep("quiz");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not start quiz", "error");
    } finally {
      setLoading(false);
    }
  }

  function selectOption(questionId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

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

  function goToQuestion(idx: number) {
    if (!quiz) return;
    const q = quiz.questions[idx];
    if (!q) return;
    setCurrentIdx(idx);
    setVisited((v) => ({ ...v, [q.id]: true }));
  }

  const answeredCount = useMemo(() => {
    if (!quiz) return 0;
    return quiz.questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  }, [quiz, answers]);

  if (!mounted) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8 text-muted-foreground">
        Loading quiz…
      </div>
    );
  }

  // ── Landing ──
  if (step === "landing") {
    if (landingError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
            <h1 className="mt-3 text-lg font-semibold">Examination unavailable</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{landingError}</p>
          </div>
        </div>
      );
    }
    if (!landing) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading examination…
        </div>
      );
    }
    const q = landing.quiz;
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-2xl animate-in fade-in duration-500">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-lg shadow-slate-200/60 dark:shadow-none">
            <div className="border-b bg-secondary/40 px-6 py-5 sm:px-8">
              <SchoolHeader schoolName={landing.schoolName} logoUrl={landing.logoUrl} />
            </div>
            <div className="space-y-6 px-6 py-7 sm:px-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Examination
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{q.title}</h1>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Subject", q.subject ?? "—"],
                  ["Teacher", q.teacherName],
                  ["Class", q.className],
                  ["Section", q.section ?? "—"],
                  ["Academic Year", q.academicYear],
                  ["Duration", q.durationMin ? `${q.durationMin} minutes` : "No limit"],
                  ["Total Questions", String(q.totalQuestions)],
                  ["Total Marks", String(q.totalMarks)],
                  ["Passing Marks", String(q.passingMarks)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border bg-secondary/20 px-3.5 py-2.5">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 text-sm font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {q.instructions && (
                <div>
                  <h2 className="text-sm font-semibold">Quiz Instructions</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {q.instructions}
                  </p>
                </div>
              )}
              <div>
                <h2 className="text-sm font-semibold">School Examination Rules</h2>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {q.examinationRules.split("\n").filter(Boolean).map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button className="h-11 w-full text-base" onClick={() => setStep("login")}>
                Start Quiz
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Login ──
  if (step === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-md space-y-6">
          {landing && (
            <SchoolHeader schoolName={landing.schoolName} logoUrl={landing.logoUrl} />
          )}
          <form
            onSubmit={(e) => void handleLogin(e)}
            className="space-y-4 rounded-2xl border bg-card p-6 shadow-lg"
          >
            <div>
              <h1 className="text-xl font-bold">Student Sign-In</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your Student ID and password to continue.
              </p>
            </div>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Default password is usually your Student ID.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying…" : "Continue"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setStep("landing")}
            >
              Back to quiz details
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Instructions (post-auth) ──
  if (step === "instructions" && access) {
    const q = access.quiz;
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-2xl">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
            <div className="border-b bg-secondary/40 px-6 py-5 sm:px-8">
              <SchoolHeader schoolName={access.schoolName} logoUrl={access.logoUrl} />
            </div>
            <div className="space-y-5 px-6 py-7 sm:px-8">
              <div>
                <h1 className="text-2xl font-bold">{q.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Welcome, <strong className="text-foreground">{access.studentName}</strong> ({access.studentCode})
                </p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border px-3 py-2.5 text-sm">
                  <dt className="text-xs text-muted-foreground">Duration</dt>
                  <dd className="font-medium">{q.timeLimitMin ?? 30} min</dd>
                </div>
                <div className="rounded-xl border px-3 py-2.5 text-sm">
                  <dt className="text-xs text-muted-foreground">Questions</dt>
                  <dd className="font-medium">{q.totalQuestions}</dd>
                </div>
                <div className="rounded-xl border px-3 py-2.5 text-sm">
                  <dt className="text-xs text-muted-foreground">Attempts left</dt>
                  <dd className="font-medium">{access.remainingAttempts}</dd>
                </div>
              </dl>
              {q.instructions && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{q.instructions}</p>
              )}
              <Button className="h-11 w-full" onClick={() => void startQuiz()} disabled={loading}>
                {loading ? "Starting…" : access.resumeAttemptId ? "Resume Quiz" : "Begin Examination"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Done / Result card ──
  if (step === "done") {
    const showScore =
      access?.quiz.showResultsImmediately &&
      result &&
      result.status !== "PENDING_REVIEW";
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
            <div className="border-b bg-secondary/40 px-6 py-5">
              <SchoolHeader
                schoolName={result?.schoolName ?? access?.schoolName ?? "School"}
                logoUrl={result?.logoUrl ?? access?.logoUrl ?? null}
              />
            </div>
            <div className="space-y-6 px-6 py-8 text-center sm:px-10">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Assessment Result
                </p>
                <h1 className="mt-1 text-2xl font-bold">
                  {result?.quiz.title ?? access?.quiz.title ?? "Quiz Submitted"}
                </h1>
              </div>
              {result?.student.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.student.photoUrl}
                  alt=""
                  className="mx-auto h-20 w-20 rounded-full object-cover ring-2 ring-primary/20"
                />
              )}
              <div>
                <p className="text-lg font-semibold">
                  {result?.student.name ?? access?.studentName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {result?.student.code ?? access?.studentCode}
                </p>
              </div>
              {!showScore ? (
                <p className="text-muted-foreground">
                  {result?.status === "PENDING_REVIEW"
                    ? "Some answers require teacher review. Results will be available after grading."
                    : "Results will be published by your teacher."}
                </p>
              ) : (
                <>
                  <div
                    className={cn(
                      "mx-auto inline-flex rounded-full px-4 py-1.5 text-sm font-semibold",
                      result.result === "PASS"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
                    )}
                  >
                    {result.result === "PASS" ? "PASS" : "FAIL"} · Grade {result.grade}
                  </div>
                  <p className="text-5xl font-bold tabular-nums text-primary">
                    {result.marksObtained}
                    <span className="text-2xl text-muted-foreground">
                      /{result.totalMarks}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.percentage}% · Time taken {formatDuration(result.timeTakenSec)}
                  </p>
                  <dl className="grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
                    {[
                      ["Attempted", result.attempted],
                      ["Correct", result.correct],
                      ["Incorrect", result.incorrect],
                      ["Unanswered", result.unanswered],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="rounded-xl border px-3 py-2">
                        <dt className="text-[11px] text-muted-foreground">{k}</dt>
                        <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {result.teacherComment && (
                    <p className="rounded-xl border bg-secondary/30 px-4 py-3 text-left text-sm">
                      <span className="font-medium">Teacher comment: </span>
                      {result.teacherComment}
                    </p>
                  )}
                </>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {showScore &&
                  (result?.quiz.allowReviewAnswers ?? access?.quiz.allowReviewAnswers) && (
                    <Button variant="outline" onClick={() => setStep("review")}>
                      Review Answers
                    </Button>
                  )}
                {showScore &&
                  (result?.quiz.allowPdfDownload ?? access?.quiz.allowPdfDownload) &&
                  result && (
                    <Button variant="outline" onClick={() => printAttemptReviewPdf(result)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Review ──
  if (step === "review" && result) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SchoolHeader schoolName={result.schoolName} logoUrl={result.logoUrl} />
            <Button variant="outline" onClick={() => setStep("done")}>
              Back to result
            </Button>
          </div>
          <h1 className="text-xl font-bold">Answer Review — {result.quiz.title}</h1>
          {result.questions.map((q) => (
            <div key={q.questionId} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground">Question {q.number}</p>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    q.status === "CORRECT" &&
                      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
                    q.status === "INCORRECT" &&
                      "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
                    q.status === "UNANSWERED" && "bg-secondary text-muted-foreground",
                  )}
                >
                  {q.status === "CORRECT"
                    ? "✅ Correct"
                    : q.status === "INCORRECT"
                      ? "❌ Incorrect"
                      : "⚪ Not Answered"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap font-medium">{q.question}</p>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border bg-secondary/20 p-3">
                  <p className="text-xs text-muted-foreground">Your Answer</p>
                  <p className="mt-1 whitespace-pre-wrap">{q.studentAnswer || "—"}</p>
                </div>
                <div className="rounded-xl border bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
                  <p className="text-xs text-muted-foreground">Correct Answer</p>
                  <p className="mt-1 whitespace-pre-wrap">{q.correctAnswer || "—"}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Marks: {q.marksAwarded} / {q.maxMarks}
              </p>
              {q.explanation && (
                <p className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-sm dark:bg-amber-950/20">
                  <span className="font-medium">Explanation: </span>
                  {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!quiz || !access) {
    return <p className="p-8 text-muted-foreground">Loading quiz…</p>;
  }

  const durationSec = (quiz.timeLimitMin ?? 30) * 60;
  const q = quiz.questions[currentIdx];
  if (!q) return null;

  function navColor(qi: PublicQuestion, idx: number) {
    if (idx === currentIdx) return "bg-sky-600 text-white ring-2 ring-sky-300";
    if (marked[qi.id]) return "bg-amber-500 text-white";
    if ((answers[qi.id] ?? "").trim()) return "bg-emerald-600 text-white";
    return "bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-white";
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{quiz.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {quiz.subject ?? "Quiz"} · {access.studentName} ({access.studentCode})
              {quiz.teacherName ? ` · ${quiz.teacherName}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {saving && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Save className="h-3 w-3" /> Saved
              </span>
            )}
            <div className="text-right">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Remaining
              </p>
              <p
                className={cn(
                  "text-xl font-bold tabular-nums",
                  secondsLeft < 60 ? "text-rose-600" : "text-foreground",
                )}
              >
                {formatDuration(Math.max(0, secondsLeft))}
              </p>
            </div>
          </div>
        </div>
        <div className="h-1.5 bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${durationSec ? (secondsLeft / durationSec) * 100 : 100}%`,
            }}
          />
        </div>
      </div>

      {(violations > 0 ||
        quiz.preventMinimize ||
        quiz.resetOnMinimize ||
        quiz.disableCopyPaste) && (
        <div className="mx-auto max-w-6xl space-y-2 px-4 pt-4">
          {violations > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-400 bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Warning ({violations}): You left the exam window.
                {quiz.resetOnMinimize ? " Answers were cleared." : ""}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Question {currentIdx + 1} of {quiz.questions.length} · {q.marks} mark
                {q.marks === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground">
                {answeredCount}/{quiz.questions.length} answered
              </p>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-base font-medium leading-relaxed sm:text-lg">
              {q.question}
            </p>

            {q.questionType === "MCQ" ? (
              <div className="mt-5 space-y-2.5">
                {(q.options ?? []).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => selectOption(q.id, opt)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3.5 text-left text-sm transition",
                      answers[q.id] === opt
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-secondary",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : q.questionType === "MATCH" ? (
              <div className="mt-5 space-y-2.5">
                {(q.matchLeft ?? []).map((left, li) => (
                  <div key={li} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="flex-1 rounded-xl border bg-secondary/40 px-3 py-2.5 text-sm">
                      {left}
                    </span>
                    <select
                      className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                      value={readArr(q.id, (q.matchLeft ?? []).length)[li] ?? ""}
                      onChange={(e) =>
                        setArrAt(q.id, li, e.target.value, (q.matchLeft ?? []).length)
                      }
                    >
                      <option value="">Select…</option>
                      {(q.matchChoices ?? []).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : q.questionType === "FILL_BLANK" ? (
              <div className="mt-5 space-y-2.5">
                {Array.from({ length: q.blankCount ?? 1 }).map((_, bi) => (
                  <div key={bi} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Blank {bi + 1}</span>
                    <Input
                      value={readArr(q.id, q.blankCount ?? 1)[bi] ?? ""}
                      onChange={(e) =>
                        setArrAt(q.id, bi, e.target.value, q.blankCount ?? 1)
                      }
                      placeholder={`Answer ${bi + 1}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Textarea
                className="mt-5"
                rows={5}
                value={answers[q.id] ?? ""}
                onChange={(e) => selectOption(q.id, e.target.value)}
                placeholder="Type your answer…"
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={currentIdx === 0}
              onClick={() => goToQuestion(currentIdx - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              disabled={currentIdx >= quiz.questions.length - 1}
              onClick={() => goToQuestion(currentIdx + 1)}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setMarked((m) => ({ ...m, [q.id]: !m[q.id] }))
              }
            >
              <Flag className="mr-1 h-4 w-4" />
              {marked[q.id] ? "Unmark" : "Mark for Review"}
            </Button>
            <Button variant="outline" onClick={() => void persistAnswers()}>
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
            <Button
              className="ml-auto"
              onClick={() => {
                if (confirm("Submit quiz? You cannot change answers after submitting.")) {
                  void handleSubmit();
                }
              }}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" /> Submit Quiz
            </Button>
          </div>
        </div>

        <aside className="rounded-2xl border bg-card p-4 shadow-sm lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Questions
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-4">
            {quiz.questions.map((qi, idx) => (
              <button
                key={qi.id}
                type="button"
                onClick={() => goToQuestion(idx)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold transition",
                  navColor(qi, idx),
                )}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-1.5 text-[11px] text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded bg-slate-300" /> Not visited
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded bg-sky-600" /> Current
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded bg-emerald-600" /> Answered
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded bg-amber-500" /> Marked
            </li>
          </ul>
        </aside>
      </div>
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
