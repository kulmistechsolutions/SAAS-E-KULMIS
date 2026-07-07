"use client";

import { useMemo } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePortal, usePortalAudit } from "@/components/parent-portal/portal-context";
import { childExamResults } from "@/lib/parent-portal/store";
import { printResultSlip } from "@/lib/parent-portal/print";
import { studentFinalResult } from "@/lib/examinations/store";

export default function ParentExamsPage() {
  const { selectedChild } = usePortal();
  usePortalAudit("RESULT_VIEWED", selectedChild?.id);

  const examData = useMemo(
    () => (selectedChild ? childExamResults(selectedChild.id) : null),
    [selectedChild],
  );

  const finalResult = useMemo(
    () => (selectedChild ? studentFinalResult(selectedChild.id) : null),
    [selectedChild],
  );

  if (!selectedChild) {
    return <p className="text-muted-foreground">Select a child to view exam results.</p>;
  }

  if (examData?.blocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Exam Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">{selectedChild.fullName}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            This student&apos;s examination result is currently unavailable.
          </p>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Please contact the school administration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exam Results</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Published results only · {selectedChild.fullName}
        </p>
      </div>

      {finalResult && finalResult.termResults.length > 1 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Final Academic Result</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Weighted average across {finalResult.termResults.length} terms · Grade{" "}
            {finalResult.finalGrade} · {finalResult.passed ? "Pass" : "Fail"}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-3 py-2">Subject</th>
                  {finalResult.termResults.map((t) => (
                    <th key={t.examId} className="px-3 py-2">{t.term}</th>
                  ))}
                  <th className="px-3 py-2">Final</th>
                  <th className="px-3 py-2">Grade</th>
                </tr>
              </thead>
              <tbody>
                {finalResult.subjectBreakdown.map((s) => (
                  <tr key={s.subject} className="border-b">
                    <td className="px-3 py-2 font-medium">{s.subject}</td>
                    {finalResult.termResults.map((t) => (
                      <td key={t.examId} className="px-3 py-2">
                        {s.termMarks[t.term] ?? "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2">{s.finalMarks}</td>
                    <td className="px-3 py-2">{s.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {examData?.results.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No published examination results yet.
        </div>
      )}

      {examData?.results.map((result) => (
        <div key={result.examId} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{result.examName}</h2>
              <p className="text-sm text-muted-foreground">
                {result.term} · Weight {result.weightPercent}%
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={result.passed ? "success" : "danger"}>
                {result.passed ? "Pass" : "Fail"}
              </Badge>
              <Badge tone="info">Grade {result.grade}</Badge>
              <Button onClick={() => printResultSlip(selectedChild, result)}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button onClick={() => printResultSlip(selectedChild, result)}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50 text-left">
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Max Marks</th>
                  <th className="px-3 py-2">Obtained</th>
                  <th className="px-3 py-2">Grade</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {result.subjects.map((s) => (
                  <tr key={s.subject} className="border-b">
                    <td className="px-3 py-2">{s.subject}</td>
                    <td className="px-3 py-2">{s.maxMarks}</td>
                    <td className="px-3 py-2 font-medium">{s.marksObtained}</td>
                    <td className="px-3 py-2">{s.grade}</td>
                    <td className="px-3 py-2">
                      {s.marksObtained >= s.maxMarks * 0.4 ? "Pass" : "Fail"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/30 font-medium">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2">{result.totalMax}</td>
                  <td className="px-3 py-2">{result.totalObtained}</td>
                  <td className="px-3 py-2">{result.grade}</td>
                  <td className="px-3 py-2">{result.passed ? "Pass" : "Fail"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
