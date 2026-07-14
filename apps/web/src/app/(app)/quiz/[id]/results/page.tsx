"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attemptsForQuiz, exportQuizResultsCsv, getQuiz, loadAttemptsForQuiz } from "@/lib/quiz/store";
import { dateTime, resultLabel } from "@/lib/quiz/format";
import { printQuizResult } from "@/lib/quiz/print";

export default function QuizResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const quiz = useMemo(() => getQuiz(id), [id]);
  const [attempts, setAttempts] = useState(() => (quiz ? attemptsForQuiz(quiz.id) : []));

  useEffect(() => {
    if (!quiz) return;
    void loadAttemptsForQuiz(quiz.id).then(setAttempts);
  }, [quiz]);

  if (!quiz) return <p>Quiz not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-4">
        <div>
          <Link href={`/quiz/${quiz.id}`} className="inline-flex items-center gap-2 text-sm text-primary">
            <ArrowLeft className="h-4 w-4" />Back to Quiz
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Results — {quiz.title}</h1>
        </div>
        <Button variant="outline" className="h-9" onClick={() => exportQuizResultsCsv(quiz.id)}>
          <Download className="mr-2 h-4 w-4" />Export CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Student</th>
              <th className="px-4 py-2.5">Attempt</th>
              <th className="px-4 py-2.5">Score</th>
              <th className="px-4 py-2.5">Grade</th>
              <th className="px-4 py-2.5">Result</th>
              <th className="px-4 py-2.5">Submitted</th>
              <th className="px-4 py-2.5">Print</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-4 py-2.5">{a.studentName}</td>
                <td className="px-4 py-2.5">{a.attemptNumber}</td>
                <td className="px-4 py-2.5 tabular-nums">{a.obtainedMarks ?? "—"} / {a.totalMarks}</td>
                <td className="px-4 py-2.5">{a.grade ?? "—"}</td>
                <td className="px-4 py-2.5">{resultLabel(a.result)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{a.submittedAt ? dateTime(a.submittedAt) : "—"}</td>
                <td className="px-4 py-2.5">
                  {a.status !== "IN_PROGRESS" && (
                    <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => printQuizResult(quiz, a)}>Print</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
