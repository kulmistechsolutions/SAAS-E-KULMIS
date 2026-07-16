"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiQuizLiveMonitoring, type QuizLiveMonitoringResponse } from "@/lib/quiz/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  TIME_EXPIRED: "Time Expired",
};

const STATUS_CLASS: Record<string, string> = {
  NOT_STARTED: "bg-secondary text-muted-foreground",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  TIME_EXPIRED: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
};

function fmtTime(iso: string | null): string {
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

export default function QuizLiveMonitoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const quizBase = user?.role === "TEACHER" ? "/teacher-portal/quizzes" : "/quiz";
  const [data, setData] = useState<QuizLiveMonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiQuizLiveMonitoring(id);
      setData(res);
    } catch (e) {
      if (!silent) toast(e instanceof Error ? e.message : "Could not load monitoring data", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => void load(true), 10_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  if (loading) return <p className="text-muted-foreground">Loading live monitoring…</p>;
  if (!data) return <p className="text-muted-foreground">Quiz not found.</p>;

  const { quiz, summary, students } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href={`${quizBase}/${quiz.id}`} className="inline-flex items-center gap-2 text-sm text-primary">
            <ArrowLeft className="h-4 w-4" />Back to Quiz
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Live Monitoring — {quiz.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quiz.className}{quiz.section ? ` — ${quiz.section}` : ""} · Auto-refreshes every 10s
          </p>
        </div>
        <Button variant="outline" className="h-9" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Students" value={summary.total} />
        <Stat label="Not Started" value={summary.notStarted} />
        <Stat label="In Progress" value={summary.inProgress} />
        <Stat label="Completed" value={summary.completed} />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">No</th>
              <th className="px-4 py-2.5">Student ID</th>
              <th className="px-4 py-2.5">Student Name</th>
              <th className="px-4 py-2.5">Class</th>
              <th className="px-4 py-2.5">Section</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Start Time</th>
              <th className="px-4 py-2.5">Finish Time</th>
              <th className="px-4 py-2.5">Score</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.studentId} className="border-t">
                <td className="px-4 py-2.5">{s.no}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.studentCode}</td>
                <td className="px-4 py-2.5">{s.studentName}</td>
                <td className="px-4 py-2.5">{s.className}</td>
                <td className="px-4 py-2.5">{s.section ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{fmtTime(s.startTime)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{fmtTime(s.finishTime)}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {s.status === "COMPLETED" && s.percentage != null ? `${Math.round(s.percentage * 10) / 10}%` : "—"}
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  No students assigned to this quiz&apos;s class/section.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
