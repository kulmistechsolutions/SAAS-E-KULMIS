"use client";

import { useMemo, useState } from "react";
import { Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ExamStatusBadge } from "@/components/examinations/exam-status-badge";
import {
  getExam,
  studentExamResult,
  updateExamStatus,
  useExaminationsState,
} from "@/lib/examinations/store";
import { getState as getStudentsState } from "@/lib/students/store";
import { toast } from "@/lib/toast";

export default function ExamResultsPage() {
  const { exams } = useExaminationsState();
  const [examId, setExamId] = useState("");

  const exam = examId ? getExam(examId) : undefined;
  const students = getStudentsState().students;

  const results = useMemo(() => {
    if (!exam) return [];
    return students
      .filter(
        (s) =>
          s.status === "ACTIVE" &&
          s.className === exam.className &&
          (s.section ?? "") === exam.section,
      )
      .map((st) => {
        const r = studentExamResult(st.id, exam.id);
        return r ? { student: st, result: r } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.result.average - a.result.average);
  }, [exam, students, exams]);

  function lockExam() {
    if (!exam) return;
    const res = updateExamStatus(exam.id, "LOCKED");
    if (!res.ok) toast(res.error ?? "Failed", "error");
    else toast("Exam locked", "success");
  }

  function publishExam() {
    if (!exam) return;
    if (exam.status !== "LOCKED" && exam.status !== "COMPLETED") {
      toast("Lock the exam before publishing", "error");
      return;
    }
    const res = updateExamStatus(exam.id, "PUBLISHED");
    if (!res.ok) toast(res.error ?? "Failed", "error");
    else toast("Results published", "success");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Results & Publishing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lock examinations and publish results to student and parent portals.
          </p>
        </div>
        {exam && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={lockExam} disabled={exam.status === "LOCKED" || exam.status === "PUBLISHED"}>
              <Lock className="mr-2 h-4 w-4" />
              Lock Exam
            </Button>
            <Button onClick={publishExam} disabled={exam.status === "PUBLISHED"}>
              <Send className="mr-2 h-4 w-4" />
              Publish Results
            </Button>
          </div>
        )}
      </div>

      <Select value={examId} onChange={(e) => setExamId(e.target.value)} className="max-w-md">
        <option value="">Select examination…</option>
        {exams.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} — {e.className} {e.section} ({e.status})
          </option>
        ))}
      </Select>

      {exam && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
            <h2 className="font-semibold">{exam.name}</h2>
            <ExamStatusBadge status={exam.status} />
            <span className="text-sm text-muted-foreground">
              {exam.className} — {exam.section} · Weight {exam.weightPercent}%
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">#</th>
                  <th className="px-4 py-2.5 font-medium">Student</th>
                  <th className="px-4 py-2.5 font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Average</th>
                  <th className="px-4 py-2.5 font-medium">Grade</th>
                  <th className="px-4 py-2.5 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.student.id} className="border-t">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{r.student.fullName}</p>
                      <p className="text-xs text-muted-foreground">{r.student.code}</p>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{r.result.totalObtained}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.result.average.toFixed(1)}</td>
                    <td className="px-4 py-2.5 font-semibold">{r.result.grade}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.result.passed ? "success" : "danger"}>
                        {r.result.passed ? "Pass" : "Fail"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
