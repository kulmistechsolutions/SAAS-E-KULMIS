"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  apiQuizAttemptResultStaff,
  apiQuizLiveMonitoring,
  type QuizAttemptReview,
  type QuizLiveMonitoringResponse,
  type QuizLiveStudentRow,
} from "@/lib/quiz/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { printAttemptReviewPdf } from "@/lib/quiz/print";

const STATUS_LABEL: Record<string, string> = {
  LINK_NOT_OPENED: "Link Not Opened",
  LINK_OPENED: "Link Opened",
  LOGGED_IN: "Logged In",
  TAKING_QUIZ: "Taking Quiz",
  SUBMITTED: "Submitted",
  TIME_EXPIRED: "Time Expired",
  // legacy
  NOT_STARTED: "Link Not Opened",
  IN_PROGRESS: "Taking Quiz",
  COMPLETED: "Submitted",
};

const STATUS_CLASS: Record<string, string> = {
  LINK_NOT_OPENED: "bg-secondary text-muted-foreground",
  LINK_OPENED: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  LOGGED_IN: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
  TAKING_QUIZ: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  SUBMITTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  TIME_EXPIRED: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  NOT_STARTED: "bg-secondary text-muted-foreground",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
};

const EVENT_LABEL: Record<string, string> = {
  LINK_OPENED: "Quiz Link Opened",
  LOGGED_IN: "Student Logged In",
  QUIZ_STARTED: "Quiz Started",
  QUIZ_SUBMITTED: "Quiz Submitted",
  SCORE_GENERATED: "Score Generated",
  TIME_EXPIRED: "Time Expired",
};

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function QuizLiveMonitoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const quizBase = user?.role === "TEACHER" ? "/teacher-portal/quizzes" : "/quiz";
  const [data, setData] = useState<QuizLiveMonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QuizLiveStudentRow | null>(null);
  const [review, setReview] = useState<QuizAttemptReview | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await apiQuizLiveMonitoring(id);
        setData(res);
      } catch (e) {
        if (!silent)
          toast(e instanceof Error ? e.message : "Could not load monitoring data", "error");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => void load(true), 8_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  async function openStudent(row: QuizLiveStudentRow) {
    setSelected(row);
    setReview(null);
    if (row.attemptId && (row.status === "SUBMITTED" || row.status === "COMPLETED")) {
      try {
        const r = await apiQuizAttemptResultStaff(row.attemptId);
        setReview(r);
      } catch {
        /* timeline-only view */
      }
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading live monitoring…</p>;
  if (!data) return <p className="text-muted-foreground">Quiz not found.</p>;

  const { quiz, summary, students } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`${quizBase}/${quiz.id}`}
            className="inline-flex items-center gap-2 text-sm text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Quiz
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Live Monitoring — {quiz.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quiz.className}
            {quiz.section ? ` — ${quiz.section}` : ""} · Auto-refreshes every 8s
          </p>
        </div>
        <Button variant="outline" className="h-9" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Total Students" value={summary.total} />
        <Stat label="Link Not Opened" value={summary.linkNotOpened ?? summary.notStarted} />
        <Stat label="Link Opened" value={summary.linkOpened ?? 0} />
        <Stat label="Logged In" value={summary.loggedIn ?? 0} />
        <Stat label="In Progress" value={summary.inProgress} />
        <Stat label="Completed" value={summary.completed} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">No</th>
                <th className="px-4 py-2.5">Student</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Login</th>
                <th className="px-4 py-2.5">Started</th>
                <th className="px-4 py-2.5">Submitted</th>
                <th className="px-4 py-2.5">Score</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.studentId}
                  className={cn(
                    "cursor-pointer border-t transition hover:bg-secondary/40",
                    selected?.studentId === s.studentId && "bg-primary/5",
                  )}
                  onClick={() => void openStudent(s)}
                >
                  <td className="px-4 py-2.5">{s.no}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{s.studentName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{s.studentCode}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[s.status] ?? STATUS_CLASS.LINK_NOT_OPENED}`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {fmtTime(s.loginAt ?? null)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtTime(s.startTime)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtTime(s.finishTime)}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {s.status === "SUBMITTED" || s.status === "COMPLETED"
                      ? s.percentage != null
                        ? `${Math.round(s.percentage * 10) / 10}%`
                        : "—"
                      : "—"}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    No students assigned to this quiz&apos;s class/section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Select a student to view their activity timeline and result sheet.
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold">{selected.studentName}</h2>
                <p className="text-xs text-muted-foreground">{selected.studentCode}</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Activity Timeline
                </h3>
                <ol className="mt-3 space-y-0">
                  {(selected.timeline ?? []).length === 0 && (
                    <li className="text-sm text-muted-foreground">No activity yet.</li>
                  )}
                  {(selected.timeline ?? []).map((e, i, arr) => (
                    <li key={`${e.event}-${e.at}`} className="relative flex gap-3 pb-4">
                      <div className="flex flex-col items-center">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                        {i < arr.length - 1 && (
                          <span className="w-px flex-1 bg-border" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {EVENT_LABEL[e.event] ?? e.event}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtTime(e.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {review && (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Result Sheet
                  </h3>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Score</dt>
                      <dd className="font-semibold">
                        {review.marksObtained}/{review.totalMarks} ({review.percentage}%)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Grade / Result</dt>
                      <dd className="font-semibold">
                        {review.grade} · {review.result ?? "—"}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    variant="outline"
                    className="h-9 w-full"
                    onClick={() => printAttemptReviewPdf(review)}
                  >
                    Print / PDF Result
                  </Button>
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {review.questions.map((q) => (
                      <div key={q.questionId} className="rounded-lg border p-2.5 text-xs">
                        <p className="font-medium">
                          Q{q.number}: {q.status}
                        </p>
                        <p className="mt-1 text-muted-foreground line-clamp-2">{q.question}</p>
                        <p className="mt-1">
                          Student: {q.studentAnswer || "—"} · Correct: {q.correctAnswer || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
