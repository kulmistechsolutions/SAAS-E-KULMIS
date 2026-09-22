"use client";


import { useT } from "@/lib/i18n/provider";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  apiClearQuizAnswers,
  apiQuizAttemptReview,
  apiQuizByCode,
  apiQuizLanding,
  apiQuizLinkOpened,
  apiSaveQuizAnswers,
  apiStartQuizAttempt,
  apiSubmitQuizAttempt,
  apiVerifyQuizAccess,
  apiPracticeQuiz,
  apiSubmitPracticeQuiz,
  type ApiQuiz,
  type QuizAccessResponse,
  type QuizPracticePaper,
  type QuizAttemptReview,
  type QuizLandingResponse,
} from "@/lib/quiz/api";
import { formatDuration } from "@/lib/quiz/format";
import { printAttemptReviewPdf } from "@/lib/quiz/print";
import { resolveLogoUrl } from "@/lib/settings/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { QuizText, quizFieldProps } from "@/components/quiz/rtl-text";
import { RichText } from "@/components/quiz/rich-text";
import {
  resolveDirection,
  tfLabels,
  type DirectionSetting,
  type TfValue,
} from "@ekulmis/shared";
import { FlaskConical, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useHydrated } from "@/lib/use-hydrated";

type PublicQuestion = {
  id: string;
  question: string;
  questionType?: string;
  options?: string[];
  matchLeft?: string[];
  matchChoices?: string[];
  blankCount?: number;
  marks: number;
  direction?: DirectionSetting | null;
  contentFont?: string | null;
  /** The question as the teacher formatted it; null when it is plain. */
  questionHtml?: string | null;
  /** The formatted options, in the order they are being served. */
  optionsHtml?: string[] | null;
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
  /** The paper's declared language: decides what the True / False buttons say. */
  language?: string | null;
  direction?: DirectionSetting | null;
  contentFont?: string | null;
  instructionsHtml?: string | null;
  questions: PublicQuestion[];
};

type Step = "landing" | "login" | "instructions" | "quiz" | "done" | "review";

/**
 * Said on every practice screen, and plainly.
 *
 * Small enough not to get in the way of the paper, clear enough that nobody
 * — including a head teacher looking over a shoulder — takes the score at the
 * end for a student's.
 */
function PracticeBanner() {
  const tr = useT();
  return (
    <div className="flex items-center justify-center gap-2 bg-violet-600 px-4 py-1.5 text-center text-xs font-medium text-white">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" />
      <span>{tr("quizPractice.banner")}</span>
    </div>
  );
}

function SchoolHeader({
  schoolName,
  logoUrl,
}: {
  schoolName: string;
  logoUrl: string | null;
}) {
  const t = useT();
  const tr = useT();
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
        <p className="text-xs text-muted-foreground">{tr("quizTake.onlineExamination")}</p>
      </div>
    </div>
  );
}

/**
 * The paper a student sits — and, given a quiz id instead of a code, the same
 * paper for its teacher to try.
 *
 * One screen for both on purpose. A practice run exists so the teacher sees
 * exactly what a student will: the layout, the font and size, Arabic running
 * right to left, the timer, the navigation, the marking. A second screen for
 * practice would be a second thing to keep in step, and the first place they
 * differed would be the bug the practice run was meant to catch.
 *
 * What changes in practice is only what happens around the paper: no Student
 * ID, no attempt, no autosave, and the result goes to a table no report reads.
 */
function TakeQuizContent({
  code,
  practiceQuizId,
  backHref,
}: {
  code: string;
  practiceQuizId?: string;
  backHref?: string;
}) {
  const tr = useT();
  const mounted = useHydrated();
  const practice = !!practiceQuizId;
  const { user } = useAuth();
  const [practicePaper, setPracticePaper] = useState<QuizPracticePaper | null>(null);
  const [practiceStartedAt, setPracticeStartedAt] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("landing");
  const [landing, setLanding] = useState<QuizLandingResponse | null>(null);
  const [landingError, setLandingError] = useState<string | null>(null);
  /** Why sign-in was refused. Kept on the page — a toast is gone before a
   *  student on a phone has finished reading it. */
  const [accessError, setAccessError] = useState<string | null>(null);
  const [studentCode, setStudentCode] = useState("");
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


  useEffect(() => {
    if (!practiceQuizId) return;
    let cancelled = false;
    void apiPracticeQuiz(practiceQuizId)
      .then((res) => {
        if (cancelled) return;
        setPracticePaper(res);
        const p = res.paper;
        // The instructions screen reads everything from the access answer a
        // student gets after signing in; a teacher is already signed in, so
        // the same shape is built from their own session instead.
        setAccess({
          schoolName: res.schoolName,
          logoUrl: res.logoUrl,
          logoKey: res.logoKey,
          studentId: "",
          studentCode: "PRACTICE",
          studentName: user?.username ?? "Teacher",
          studentPhotoUrl: null,
          remainingAttempts: 1,
          resumeAttemptId: null,
          quiz: {
            id: p.id,
            title: p.title,
            code: p.code,
            className: p.class?.name ?? "",
            section: p.section?.name ?? null,
            subject: p.subject?.name ?? null,
            teacherName: p.teacherName ?? "",
            academicYear: "",
            description: p.description,
            instructions: p.instructions ?? null,
            instructionsHtml: p.instructionsHtml ?? null,
            examinationRules: res.examinationRules,
            timeLimitMin: p.timeLimitMin,
            maxAttempts: 1,
            totalQuestions: (p.questions ?? []).length,
            totalMarks: res.totalMarks,
            passingMarks: res.passingMarks,
            showResultsImmediately: true,
            allowReviewAnswers: true,
            allowPdfDownload: false,
          },
        });
        setStep("instructions");
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Quiz not available";
          setLandingError(message);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceQuizId]);

  useEffect(() => {
    if (practiceQuizId) return;
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
  }, [code, practiceQuizId]);

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
        // Also wipe the server copy — startAttempt reloads savedAnswers on
        // resume, so clearing only the client would let the answers reappear.
        if (attemptId && access) {
          void apiClearQuizAnswers({
            attemptId,
            studentId: access.studentId,
          }).catch(() => undefined);
        }
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
  }, [step, submitted, quiz, attemptId, access]);

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
    if (practiceQuizId) {
      try {
        const res = await apiSubmitPracticeQuiz(practiceQuizId, {
          answers: quiz.questions.map((q) => ({
            questionId: q.id,
            answer: answers[q.id] ?? "",
          })),
          timeTakenSec: practiceStartedAt
            ? Math.round((Date.now() - practiceStartedAt) / 1000)
            : 0,
        });
        setSubmitted(true);
        setResult(res);
        setStep("done");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Submit failed", "error");
      }
      return;
    }
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
    setAccessError(null);
    try {
      void apiQuizLinkOpened({
        quizCode: code,
        studentCode: studentCode.trim(),
      }).catch(() => undefined);
      const res = await apiVerifyQuizAccess({
        quizCode: code,
        studentCode: studentCode.trim(),
      });
      setAccess(res);
      setStep("instructions");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Access denied";
      setAccessError(message);
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  function mapPaper(row: ApiQuiz & { teacherName?: string | null }, acc: QuizAccessResponse): PublicQuiz {
    const access = acc;
    return {
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
        language: row.language ?? null,
        direction: row.direction ?? null,
        contentFont: row.contentFont ?? null,
        questions: (row.questions ?? []).map((q) => ({
          id: q.id,
          question: q.question,
          questionType: q.questionType,
          options: Array.isArray(q.options) ? (q.options as string[]) : [],
          matchLeft: q.matchLeft,
          matchChoices: q.matchChoices,
          blankCount: q.blankCount,
          marks: q.marks,
          direction: q.direction ?? null,
          contentFont: q.contentFont ?? null,
          questionHtml: q.questionHtml ?? null,
          optionsHtml: Array.isArray(q.optionsHtml) ? q.optionsHtml : null,
        })),
      };
  }

  async function startQuiz() {
    if (!access) return;
    setLoading(true);
    if (practicePaper) {
      // Straight in: nothing to resume, nothing saved, no attempt counted.
      const mapped = mapPaper(practicePaper.paper, access);
      setAnswers({});
      setMarked({});
      setSubmitted(false);
      setResult(null);
      setViolations(0);
      setQuiz(mapped);
      setSecondsLeft((mapped.timeLimitMin ?? 30) * 60);
      setCurrentIdx(0);
      setVisited(mapped.questions[0] ? { [mapped.questions[0].id]: true } : {});
      setPracticeStartedAt(Date.now());
      setStep("quiz");
      setLoading(false);
      return;
    }
    try {
      const row = await apiQuizByCode(code);
      const mapped = mapPaper(row, access);
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
        {tr("quizTake.loadingQuiz")}
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
            <h1 className="mt-3 text-lg font-semibold">{tr("quizTake.examinationUnavailable")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{landingError}</p>
          </div>
        </div>
      );
    }
    if (!landing) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {tr("quizTake.loadingExamination")}
        </div>
      );
    }
    const q = landing.quiz;
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-2xl animate-in fade-in duration-500">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-lg shadow-slate-200/60 dark:shadow-none">
            <div className="border-b bg-secondary/40 px-6 py-5 sm:px-8">
              <SchoolHeader schoolName={landing.schoolName} logoUrl={resolveLogoUrl(landing.logoUrl, landing.logoKey)} />
            </div>
            <div className="space-y-6 px-6 py-7 sm:px-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tr("quizTake.examination")}
                </p>
                <QuizText
                  as="h1"
                  text={q.title}
                  className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
                />
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
                  <h2 className="text-sm font-semibold">{tr("quizTake.quizInstructions")}</h2>
                  <RichText
                    as="p"
                    text={q.instructions}
                    html={landing?.quiz.instructionsHtml}
                    className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                  />
                </div>
              )}
              <div>
                <h2 className="text-sm font-semibold">{tr("quizTake.schoolExaminationRules")}</h2>
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
                {tr("quizTake.startQuiz")}
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
            <SchoolHeader schoolName={landing.schoolName} logoUrl={resolveLogoUrl(landing.logoUrl, landing.logoKey)} />
          )}
          <form
            onSubmit={(e) => void handleLogin(e)}
            className="space-y-4 rounded-2xl border bg-card p-6 shadow-lg"
          >
            <div>
              <h1 className="text-xl font-bold">{tr("quizTake.studentSignIn")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {tr("quizTake.enterYourStudentIdToContinue")}
              </p>
            </div>
            <div>
              <Label htmlFor="studentCode">{tr("quizTake.studentId")}</Label>
              <Input
                id="studentCode"
                className="mt-1.5"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                placeholder={tr("quizTake.eGShmm000001")}
                autoFocus
                required
              />
            </div>
            {accessError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
              >
                {accessError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying…" : "Continue"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setStep("landing")}
            >
              {tr("quizTake.backToQuizDetails")}
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-950 dark:to-slate-900">
        {practice && <PracticeBanner />}
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
            <div className="border-b bg-secondary/40 px-6 py-5 sm:px-8">
              <SchoolHeader schoolName={access.schoolName} logoUrl={resolveLogoUrl(access.logoUrl, access.logoKey)} />
            </div>
            <div className="space-y-5 px-6 py-7 sm:px-8">
              <div>
                <QuizText as="h1" text={q.title} className="text-2xl font-bold" />
                <p className="mt-1 text-sm text-muted-foreground">
                  {tr("quizTake.welcome")} <strong className="text-foreground">{access.studentName}</strong> ({access.studentCode})
                </p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border px-3 py-2.5 text-sm">
                  <dt className="text-xs text-muted-foreground">{tr("quizTake.duration")}</dt>
                  <dd className="font-medium">{q.timeLimitMin ?? 30} {tr("quizTake.min")}</dd>
                </div>
                <div className="rounded-xl border px-3 py-2.5 text-sm">
                  <dt className="text-xs text-muted-foreground">{tr("quizTake.questions")}</dt>
                  <dd className="font-medium">{q.totalQuestions}</dd>
                </div>
                <div className="rounded-xl border px-3 py-2.5 text-sm">
                  <dt className="text-xs text-muted-foreground">
                    {practice ? tr("quizPractice.mode") : tr("quizTake.attemptsLeft")}
                  </dt>
                  <dd className="font-medium">
                    {practice ? tr("quizPractice.notCounted") : access.remainingAttempts}
                  </dd>
                </div>
              </dl>
              {q.instructions && (
                <RichText
                  as="p"
                  text={q.instructions}
                  html={access.quiz.instructionsHtml}
                  className="whitespace-pre-wrap text-sm text-muted-foreground"
                />
              )}
              <Button className="h-11 w-full" onClick={() => void startQuiz()} disabled={loading}>
                {practice
                  ? tr("quizPractice.start")
                  : loading
                    ? "Starting…"
                    : access.resumeAttemptId
                      ? "Resume Quiz"
                      : "Begin Examination"}
              </Button>
              {practice && backHref && (
                <Link
                  href={backHref}
                  className="block text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  {tr("quizPractice.backToQuiz")}
                </Link>
              )}
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-950 dark:to-slate-900">
        {practice && <PracticeBanner />}
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
            <div className="border-b bg-secondary/40 px-6 py-5">
              <SchoolHeader
                schoolName={result?.schoolName ?? access?.schoolName ?? "School"}
                logoUrl={
                  result
                    ? resolveLogoUrl(result.logoUrl, result.logoKey)
                    : access
                      ? resolveLogoUrl(access.logoUrl, access.logoKey)
                      : null
                }
              />
            </div>
            <div className="space-y-6 px-6 py-8 text-center sm:px-10">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {practice ? tr("quizPractice.resultTitle") : tr("quizTake.assessmentResult")}
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
                  {practice ? (
                    // Never PASS or FAIL: that is a verdict on a student, and
                    // this is a teacher checking a paper.
                    <div className="mx-auto inline-flex rounded-full bg-violet-100 px-4 py-1.5 text-sm font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                      {tr("quizPractice.practiceOnly")} · {tr("quizTake.grade")} {result.grade}
                    </div>
                  ) : (
                  <div
                    className={cn(
                      "mx-auto inline-flex rounded-full px-4 py-1.5 text-sm font-semibold",
                      result.result === "PASS"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
                    )}
                  >
                    {result.result === "PASS" ? "PASS" : "FAIL"} {tr("quizTake.grade")} {result.grade}
                  </div>
                  )}
                  <p className="text-5xl font-bold tabular-nums text-primary">
                    {result.marksObtained}
                    <span className="text-2xl text-muted-foreground">
                      /{result.totalMarks}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.percentage}{tr("quizTake.timeTaken")} {formatDuration(result.timeTakenSec)}
                  </p>
                  <dl className="grid grid-cols-2 gap-3 text-start sm:grid-cols-4">
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
                  {practice && (result.pendingMarks ?? 0) > 0 && (
                    <p className="rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-start text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      {tr("quizPractice.pendingMarks").replace(
                        "{n}",
                        String(result.pendingMarks),
                      )}
                    </p>
                  )}
                  {practice && (
                    <p className="rounded-xl border border-violet-300/60 bg-violet-50/60 px-4 py-3 text-start text-sm text-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
                      {tr("quizPractice.notRecorded")}
                    </p>
                  )}
                  {result.teacherComment && (
                    <p className="rounded-xl border bg-secondary/30 px-4 py-3 text-start text-sm">
                      <span className="font-medium">{tr("quizTake.teacherComment")} </span>
                      {result.teacherComment}
                    </p>
                  )}
                </>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {showScore &&
                  (result?.quiz.allowReviewAnswers ?? access?.quiz.allowReviewAnswers) && (
                    <Button variant="outline" onClick={() => setStep("review")}>
                      {tr("quizTake.reviewAnswers")}
                    </Button>
                  )}
                {showScore &&
                  !practice &&
                  (result?.quiz.allowPdfDownload ?? access?.quiz.allowPdfDownload) &&
                  result && (
                    <Button variant="outline" onClick={() => printAttemptReviewPdf(result)}>
                      <Download className="me-2 h-4 w-4" />
                      {tr("quizTake.downloadPdf")}
                    </Button>
                  )}
                {practice && (
                  <Button variant="outline" onClick={() => void startQuiz()}>
                    <RotateCcw className="me-2 h-4 w-4" />
                    {tr("quizPractice.tryAgain")}
                  </Button>
                )}
                {practice && backHref && (
                  <Link href={backHref}>
                    <Button>{tr("quizPractice.backToQuiz")}</Button>
                  </Link>
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {practice && <PracticeBanner />}
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
          <div className="flex items-center justify-between gap-3">
            <SchoolHeader schoolName={result.schoolName} logoUrl={resolveLogoUrl(result.logoUrl, result.logoKey)} />
            <Button variant="outline" onClick={() => setStep("done")}>
              {tr("quizTake.backToResult")}
            </Button>
          </div>
          <h1 className="text-xl font-bold">{tr("quizTake.answerReview")} {result.quiz.title}</h1>
          {result.questions.map((q) => (
            <div key={q.questionId} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground">{tr("quizTake.question")} {q.number}</p>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    q.status === "CORRECT" &&
                      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
                    q.status === "INCORRECT" &&
                      "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
                    q.status === "UNANSWERED" && "bg-secondary text-muted-foreground",
                    q.status === "PENDING" &&
                      "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
                  )}
                >
                  {q.status === "CORRECT"
                    ? "✅ Correct"
                    : q.status === "INCORRECT"
                      ? "❌ Incorrect"
                      : q.status === "PENDING"
                        ? `⏳ ${tr("quizPractice.gradedLater")}`
                        : "⚪ Not Answered"}
                </span>
              </div>
              <RichText
                as="p"
                text={q.question}
                html={q.questionHtml}
                direction={q.direction}
                quizDirection={result.quiz.direction}
                font={q.contentFont}
                quizFont={result.quiz.contentFont}
                className="mt-2 whitespace-pre-wrap font-medium"
              />
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border bg-secondary/20 p-3">
                  <p className="text-xs text-muted-foreground">{tr("quizTake.yourAnswer")}</p>
                  <QuizText
                    as="p"
                    text={q.studentAnswer || "—"}
                    direction={q.direction}
                    quizDirection={result.quiz.direction}
                    font={q.contentFont}
                    quizFont={result.quiz.contentFont}
                    className="mt-1 whitespace-pre-wrap"
                  />
                </div>
                <div className="rounded-xl border bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
                  <p className="text-xs text-muted-foreground">{tr("quizTake.correctAnswer")}</p>
                  <QuizText
                    as="p"
                    text={q.correctAnswer || "—"}
                    direction={q.direction}
                    quizDirection={result.quiz.direction}
                    font={q.contentFont}
                    quizFont={result.quiz.contentFont}
                    className="mt-1 whitespace-pre-wrap"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {tr("quizTake.marks")} {q.marksAwarded} / {q.maxMarks}
              </p>
              {q.explanation && (
                <p className="mt-3 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-sm dark:bg-amber-950/20">
                  <span className="font-medium">{tr("quizTake.explanation")} </span>
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
    return <p className="p-8 text-muted-foreground">{tr("quizTake.loadingQuiz")}</p>;
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

  // Which way this question runs, for the True / False words.
  const qDir = resolveDirection(q.direction ?? quiz.direction ?? "AUTO", q.question);
  const tf = tfLabels(quiz.language, qDir);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        {practice && <PracticeBanner />}
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
                <Save className="h-3 w-3" /> {tr("quizTake.saved")}
              </span>
            )}
            <div className="text-end">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {tr("quizTake.remaining")}
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
                {tr("quizTake.warning")}{violations}{tr("quizTake.youLeftTheExamWindow")}
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
                {tr("quizTake.question")} {currentIdx + 1} {tr("quizTake.of")} {quiz.questions.length} · {q.marks} {tr("quizTake.mark")}
                {q.marks === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground">
                {answeredCount}/{quiz.questions.length} {tr("quizTake.answered")}
              </p>
            </div>
            <RichText
              as="p"
              text={q.question}
              html={q.questionHtml}
              direction={q.direction}
              quizDirection={quiz.direction}
              font={q.contentFont}
              quizFont={quiz.contentFont}
              className="mt-3 whitespace-pre-wrap text-base font-medium leading-relaxed sm:text-lg"
            />

            {q.questionType === "MCQ" ? (
              <div className="mt-5 space-y-2.5">
                {(q.options ?? []).map((opt, oi) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => selectOption(q.id, opt)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3.5 text-start text-sm transition",
                      answers[q.id] === opt
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-secondary",
                    )}
                  >
                    <RichText
                      text={opt}
                      html={q.optionsHtml?.[oi] ?? null}
                      direction={q.direction}
                      quizDirection={quiz.direction}
                      font={q.contentFont}
                      quizFont={quiz.contentFont}
                      className="block"
                    />
                  </button>
                ))}
              </div>
            ) : q.questionType === "MATCH" ? (
              <div className="mt-5 space-y-2.5">
                {(q.matchLeft ?? []).map((left, li) => (
                  <div key={li} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <QuizText
                      text={left}
                      direction={q.direction}
                      quizDirection={quiz.direction}
                      font={q.contentFont}
                      quizFont={quiz.contentFont}
                      className="flex-1 rounded-xl border bg-secondary/40 px-3 py-2.5 text-sm"
                    />
                    <select
                      {...quizFieldProps(
                        (q.matchChoices ?? []).join(" "),
                        q.direction,
                        quiz.direction,
                        q.contentFont,
                        quiz.contentFont,
                      )}
                      className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                      value={readArr(q.id, (q.matchLeft ?? []).length)[li] ?? ""}
                      onChange={(e) =>
                        setArrAt(q.id, li, e.target.value, (q.matchLeft ?? []).length)
                      }
                    >
                      <option value="">{tr("quizTake.select")}</option>
                      {(q.matchChoices ?? []).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : q.questionType === "TRUE_FALSE" ? (
              // Two buttons. The label is in the paper's language; what is
              // sent is TRUE or FALSE whatever the label says.
              <div dir={qDir} className="mt-5 grid grid-cols-2 gap-3">
                {(["TRUE", "FALSE"] as TfValue[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => selectOption(q.id, v)}
                    className={cn(
                      "rounded-xl border px-4 py-4 text-center text-base font-semibold transition",
                      answers[q.id] === v
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-secondary",
                    )}
                  >
                    {tf[v]}
                  </button>
                ))}
              </div>
            ) : q.questionType === "TRUE_FALSE_WRITTEN" ? (
              // The student writes the word — a different skill from pressing
              // a button, and the reason this type exists.
              <div className="mt-5 space-y-1.5">
                <Input
                  {...quizFieldProps(
                    answers[q.id] || q.question,
                    q.direction,
                    quiz.direction,
                    q.contentFont,
                    quiz.contentFont,
                  )}
                  className="h-12 text-base"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => selectOption(q.id, e.target.value)}
                  placeholder={`${tr("quizTf.writeAnswer")} ${tf.TRUE} / ${tf.FALSE}`}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
            ) : q.questionType === "FILL_BLANK" ? (
              <div className="mt-5 space-y-2.5">
                {Array.from({ length: q.blankCount ?? 1 }).map((_, bi) => (
                  <div key={bi} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{tr("quizTake.blank")} {bi + 1}</span>
                    <Input
                      {...quizFieldProps(
                        readArr(q.id, q.blankCount ?? 1)[bi] || q.question,
                        q.direction,
                        quiz.direction,
                        q.contentFont,
                        quiz.contentFont,
                      )}
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
                {...quizFieldProps(
                  answers[q.id] || q.question,
                  q.direction,
                  quiz.direction,
                  q.contentFont,
                  quiz.contentFont,
                )}
                className="mt-5"
                rows={5}
                value={answers[q.id] ?? ""}
                onChange={(e) => selectOption(q.id, e.target.value)}
                placeholder={tr("quizTake.typeYourAnswer")}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={currentIdx === 0}
              onClick={() => goToQuestion(currentIdx - 1)}
            >
              <ChevronLeft className="me-1 h-4 w-4" /> {tr("quizTake.previous")}
            </Button>
            <Button
              variant="outline"
              disabled={currentIdx >= quiz.questions.length - 1}
              onClick={() => goToQuestion(currentIdx + 1)}
            >
              {tr("quizTake.next")} <ChevronRight className="ms-1 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setMarked((m) => ({ ...m, [q.id]: !m[q.id] }))
              }
            >
              <Flag className="me-1 h-4 w-4" />
              {marked[q.id] ? "Unmark" : "Mark for Review"}
            </Button>
            {!practice && (
              <Button variant="outline" onClick={() => void persistAnswers()}>
                <Save className="me-1 h-4 w-4" /> {tr("quizTake.save")}
              </Button>
            )}
            <Button
              className="ms-auto"
              onClick={() => {
                if (confirm("Submit quiz? You cannot change answers after submitting.")) {
                  void handleSubmit();
                }
              }}
            >
              <CheckCircle2 className="me-1 h-4 w-4" /> {tr("quizTake.submitQuiz")}
            </Button>
          </div>
        </div>

        <aside className="rounded-2xl border bg-card p-4 shadow-sm lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tr("quizTake.questions")}
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
              <span className="h-2.5 w-2.5 rounded bg-slate-300" /> {tr("quizTake.notVisited")}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded bg-sky-600" /> {tr("quizTake.current")}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded bg-emerald-600" /> {tr("quizTake.answered")}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded bg-amber-500" /> {tr("quizTake.marked")}
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

/**
 * A teacher trying their own quiz, as a student would sit it.
 *
 * Mounted from the staff routes, so the teacher is already signed in and no
 * Student ID is asked for.
 */
export function PracticeQuiz({ quizId, backHref }: { quizId: string; backHref: string }) {
  const tr = useT();
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          {tr("quizTake.loadingQuiz")}
        </div>
      }
    >
      <TakeQuizContent code="" practiceQuizId={quizId} backHref={backHref} />
    </Suspense>
  );
}

/** A student sitting the quiz from its shared link. */
export function TakeQuiz({ code }: { code: string }) {
  const tr = useT();
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          {tr("quizTake.loadingQuiz")}
        </div>
      }
    >
      <TakeQuizContent code={code} />
    </Suspense>
  );
}
