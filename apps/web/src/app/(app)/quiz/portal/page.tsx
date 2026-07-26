"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { QuizStatusBadge } from "@/components/quiz/status-badge";
import { quizzesForStudent } from "@/lib/quiz/store";
import { getState as getStudentsState } from "@/lib/students/store";
import { shortDate } from "@/lib/quiz/format";

export default function StudentQuizPortalPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [studentId, setStudentId] = useState("");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const active = getStudentsState().students.filter((s) => s.status === "ACTIVE");
    if (active[0]) setStudentId(active[0].id);
  }, [mounted]);

  const rows = useMemo(() => (studentId ? quizzesForStudent(studentId) : []), [studentId]);
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

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.quizId} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.subject} · {r.quizCode}</p>
              </div>
              <QuizStatusBadge status={r.status} />
            </div>
            {r.marksObtained !== null && (
              <p className="mt-3 text-sm">{t("quizPortal.score")} <span className="font-semibold">{r.marksObtained}/{r.totalMarks}</span> ({r.percentage}%)</p>
            )}
            {r.attemptDate && <p className="mt-1 text-xs text-muted-foreground">{t("quizPortal.last")} {shortDate(r.attemptDate)}</p>}
            {r.canAttempt && (
              <Link href={`/quiz/take/${r.quizCode}?student=${studentId}`} className="mt-4 inline-block">
                <Button className="h-9"><Play className="mr-2 h-4 w-4" />{t("quizPortal.startQuiz")}</Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
