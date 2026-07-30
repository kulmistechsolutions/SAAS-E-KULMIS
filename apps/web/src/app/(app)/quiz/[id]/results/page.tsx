"use client";


import { useT } from "@/lib/i18n/provider";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  apiQuizAttemptResultStaff,
  apiQuizAttempts,
  apiQuizLiveMonitoring,
} from "@/lib/quiz/api";
import { getQuiz } from "@/lib/quiz/store";
import { dateTime, resultLabel } from "@/lib/quiz/format";
import type { GradeResult } from "@/lib/quiz/types";
import { printAttemptReviewPdf } from "@/lib/quiz/print";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";

type AttemptRow = {
  id: string;
  score: number | null;
  percentage: number | null;
  result: GradeResult | null;
  status: string;
  submittedAt: string | null;
  startedAt?: string | null;
  student: {
    code: string;
    fullName: string;
    class?: { name: string };
    section?: { name: string | null };
  };
};

export default function QuizResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useT();
  const { id } = use(params);
  const { user } = useAuth();
  const quizBase = user?.role === "TEACHER" ? "/teacher-portal/quizzes" : "/quiz";
  const quiz = useMemo(() => getQuiz(id), [id]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    completed: 0,
    avg: 0,
    high: 0,
    low: 0,
    passRate: 0,
    failRate: 0,
  });

  useEffect(() => {
    void (async () => {
      try {
        const [atts, live] = await Promise.all([
          apiQuizAttempts(id),
          apiQuizLiveMonitoring(id).catch(() => null),
        ]);
        setAttempts(atts as AttemptRow[]);
        const graded = atts.filter((a) => a.percentage != null);
        const scores = graded.map((a) => a.percentage ?? 0);
        const pass = graded.filter((a) => a.result === "PASS").length;
        const fail = graded.filter((a) => a.result === "FAIL").length;
        setSummary({
          total: live?.summary.total ?? atts.length,
          completed: live?.summary.completed ?? graded.length,
          avg: scores.length
            ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10
            : 0,
          high: scores.length ? Math.max(...scores) : 0,
          low: scores.length ? Math.min(...scores) : 0,
          passRate: graded.length ? Math.round((pass / graded.length) * 1000) / 10 : 0,
          failRate: graded.length ? Math.round((fail / graded.length) * 1000) / 10 : 0,
        });
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to load results", "error");
      }
    })();
  }, [id]);

  async function printOne(attemptId: string) {
    try {
      const review = await apiQuizAttemptResultStaff(attemptId);
      printAttemptReviewPdf(review);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not open result", "error");
    }
  }

  const title = quiz?.title ?? "Quiz";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <Link
            href={`${quizBase}/${id}`}
            className="inline-flex items-center gap-2 text-sm text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("quizResults.backToQuiz")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{t("quizResults.classResults")} {title}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`${quizBase}/${id}/live`}>
            <Button variant="outline" className="h-9">
              {t("quizResults.liveMonitor")}
            </Button>
          </Link>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => {
              const header = [
                "No",
                "Student",
                "Code",
                "Score",
                "Percentage",
                "Result",
                "Submitted",
              ];
              const rows = attempts.map((a, i) => [
                i + 1,
                a.student.fullName,
                a.student.code,
                a.score ?? "",
                a.percentage ?? "",
                a.result ?? "",
                a.submittedAt ?? "",
              ]);
              const csv = [header, ...rows]
                .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
                .join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `quiz-${id}-results.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="me-2 h-4 w-4" />
            {t("quizResults.exportCsv")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <Stat label={t("quizResults.totalStudents")} value={summary.total} />
        <Stat label={t("quizResults.completed")} value={summary.completed} />
        <Stat label={t("quizResults.average")} value={summary.avg} />
        <Stat label={t("quizResults.highest")} value={summary.high} />
        <Stat label={t("quizResults.lowest")} value={summary.low} />
        <Stat label={t("quizResults.passRate")} value={summary.passRate} />
        <Stat label={t("quizResults.failRate")} value={summary.failRate} />
        <Stat label={t("quizResults.attempts")} value={attempts.length} />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-start text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">{t("quizResults.no")}</th>
              <th className="px-4 py-2.5">{t("quizResults.student")}</th>
              <th className="px-4 py-2.5">{t("quizResults.submitted")}</th>
              <th className="px-4 py-2.5">{t("quizResults.score")}</th>
              <th className="px-4 py-2.5">%</th>
              <th className="px-4 py-2.5">{t("quizResults.result")}</th>
              <th className="px-4 py-2.5">{t("quizResults.status")}</th>
              <th className="px-4 py-2.5">{t("quizResults.sheet")}</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a, i) => (
              <tr key={a.id} className="border-t">
                <td className="px-4 py-2.5">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{a.student.fullName}</div>
                  <div className="font-mono text-xs text-muted-foreground">{a.student.code}</div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.submittedAt ? dateTime(a.submittedAt) : "—"}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{a.score ?? "—"}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {a.percentage != null ? `${a.percentage}%` : "—"}
                </td>
                <td className="px-4 py-2.5">{resultLabel(a.result)}</td>
                <td className="px-4 py-2.5">{a.status}</td>
                <td className="px-4 py-2.5">
                  {a.status !== "IN_PROGRESS" && (
                    <Button
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => void printOne(a.id)}
                    >
                      {t("quizResults.viewPdf")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {attempts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {t("quizResults.noSubmissionsYet")}
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
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
