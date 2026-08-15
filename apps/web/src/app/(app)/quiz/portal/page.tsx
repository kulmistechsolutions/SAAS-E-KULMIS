"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { QuizStatusBadge } from "@/components/quiz/status-badge";
import { quizzesForStudent } from "@/lib/quiz/store";
import { getState as getStudentsState } from "@/lib/students/store";
import type { QuizForStudentRow } from "@/lib/quiz/api";

export default function StudentQuizPortalPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [rows, setRows] = useState<QuizForStudentRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const active = getStudentsState().students.filter((s) => s.status === "ACTIVE");
    if (active[0]) setStudentId(active[0].id);
  }, [mounted]);

  useEffect(() => {
    if (!studentId) {
      setRows([]);
      return;
    }
    setLoading(true);
    void quizzesForStudent(studentId)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [studentId]);

  const students = mounted ? getStudentsState().students.filter((s) => s.status === "ACTIVE") : [];

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("quizPortal.studentQuizPortal")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("quizPortal.availableUpcomingAndCompletedQuizzes")}</p>
      </div>

      <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="h-9 max-w-xs">
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.fullName} ({s.code})</option>
        ))}
      </Select>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No quizzes assigned to this student&apos;s class yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.subject ?? "—"} · {r.code}
                  </p>
                </div>
                <QuizStatusBadge status={r.status} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {r.questionCount} questions · {r.timeLimitMin ?? "No"} min limit ·{" "}
                {r.attemptsUsed}/{r.maxAttempts} attempts used
              </p>
              {r.lastResult && r.lastResult.score !== null && (
                <p className="mt-3 text-sm">
                  {t("quizPortal.score")}{" "}
                  <span className="font-semibold">{r.lastResult.score}</span> (
                  {r.lastResult.percentage}%)
                  {r.lastResult.result ? ` — ${r.lastResult.result}` : ""}
                </p>
              )}
              {r.canAttempt && (
                <Link href={`/quiz/take/${r.code}?student=${studentId}`} className="mt-4 inline-block">
                  <Button className="h-9"><Play className="me-2 h-4 w-4" />{t("quizPortal.startQuiz")}</Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
