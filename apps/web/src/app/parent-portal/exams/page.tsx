"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePortal, usePortalAudit } from "@/components/parent-portal/portal-context";
import { fetchChildExamResults } from "@/lib/parent-portal/store";
import { printResultSlip } from "@/lib/parent-portal/print";
import type { StudentExamResult } from "@/lib/examinations/types";

export default function ParentExamsPage() {
  const t = useT();
  const { selectedChild } = usePortal();
  usePortalAudit("RESULT_VIEWED", selectedChild?.id);

  const [blocked, setBlocked] = useState(false);
  const [results, setResults] = useState<StudentExamResult[]>([]);
  const [finalGrade, setFinalGrade] = useState<string | null>(null);
  const [finalPassed, setFinalPassed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedChild) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchChildExamResults(selectedChild.id).then((data) => {
      setBlocked(data.blocked);
      setResults(data.results);
      setFinalGrade(data.finalGrade ?? null);
      setFinalPassed(data.passed ?? null);
      setLoading(false);
    });
  }, [selectedChild]);

  if (!selectedChild) {
    return <p className="text-muted-foreground">{t("parentPortalExams.selectAChildToViewExam")}</p>;
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("parentPortalExams.loadingResults")}</p>;
  }

  if (blocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("parentPortalExams.examResults")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{selectedChild.fullName}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            {t("parentPortalExams.thisStudentAposSExaminationResult")}
          </p>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            {t("parentPortalExams.pleaseContactTheSchoolAdministration")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("parentPortalExams.examResults")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("parentPortalExams.publishedResultsOnly")} {selectedChild.fullName}
        </p>
      </div>

      {finalGrade && results.length > 1 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">{t("parentPortalExams.finalAcademicResult")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("parentPortalExams.grade")} {finalGrade} · {finalPassed ? "Pass" : "Fail"}
          </p>
        </div>
      )}

      {results.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          {t("parentPortalExams.noPublishedExaminationResultsYet")}
        </div>
      )}

      {results.map((result) => (
        <div key={result.examId} className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{result.examName}</h2>
              <p className="text-sm text-muted-foreground">
                {result.term} {t("parentPortalExams.weight")} {result.weightPercent}%
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={result.passed ? "success" : "danger"}>
                {result.passed ? "Pass" : "Fail"}
              </Badge>
              <Badge tone="info">{t("parentPortalExams.grade")} {result.grade}</Badge>
              <Button onClick={() => printResultSlip(selectedChild, result)}>
                <Printer className="me-2 h-4 w-4" />
                {t("parentPortalExams.print")}
              </Button>
              <Button onClick={() => printResultSlip(selectedChild, result)}>
                <Download className="me-2 h-4 w-4" />
                {t("parentPortalExams.pdf")}
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50 text-start">
                  <th className="px-3 py-2">{t("parentPortalExams.subject")}</th>
                  <th className="px-3 py-2">{t("parentPortalExams.maxMarks")}</th>
                  <th className="px-3 py-2">{t("parentPortalExams.obtained")}</th>
                  <th className="px-3 py-2">{t("parentPortalExams.grade")}</th>
                  <th className="px-3 py-2">{t("parentPortalExams.result")}</th>
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
                  <td className="px-3 py-2">{t("parentPortalExams.total")}</td>
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
