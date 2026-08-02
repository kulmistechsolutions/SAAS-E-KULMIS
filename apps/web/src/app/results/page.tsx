"use client";


import { useT } from "@/lib/i18n/provider";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GraduationCap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { buildExamGroupBreakdown, lookupPublicResults } from "@/lib/examinations/store";
import type { StudentExamResult, StudentFinalResult } from "@/lib/examinations/types";
import { ExamResultCard, type ExamResultCardData } from "@/components/examinations/exam-result-card";
import { toast } from "@/lib/toast";

export default function PublicResultsPage() {
  const t = useT();
  const branding = useSchoolBranding();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [termResults, setTermResults] = useState<StudentExamResult[]>([]);
  const [finalResult, setFinalResult] = useState<StudentFinalResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const runSearch = useCallback(async (raw: string) => {
    if (!raw.trim()) return;
    setLoading(true);
    setSearched(true);
    setNotFound(false);
    setBlocked(false);
    setBlockedReason(null);
    setTermResults([]);
    setFinalResult(null);

    const res = await lookupPublicResults(raw.trim());
    setLoading(false);

    if (!res.ok) {
      setNotFound(true);
      toast(res.error ?? "Student ID not found.", "error");
      return;
    }
    if (res.blocked) {
      setBlocked(true);
      setBlockedReason(res.blockedReason ?? null);
      return;
    }
    if (res.result) {
      setTermResults(res.result.termResults);
      setFinalResult(res.result);
    }
  }, []);

  function handleSearch() {
    void runSearch(code);
  }

  // A scanned result-card QR lands here as /results?code=STU-123 — look it up right away.
  useEffect(() => {
    const fromQr = new URLSearchParams(window.location.search).get("code");
    if (!fromQr) return;
    setCode(fromQr);
    void runSearch(fromQr);
  }, [runSearch]);

  const student = finalResult;

  const cards = useMemo<ExamResultCardData[]>(() => {
    if (!finalResult) return [];
    const seenGroups = new Set<string>();
    const list: ExamResultCardData[] = [];
    for (const tr of termResults) {
      if (tr.examGroupId) {
        if (seenGroups.has(tr.examGroupId)) continue;
        seenGroups.add(tr.examGroupId);
        const breakdown = buildExamGroupBreakdown(finalResult, tr.examGroupId);
        if (!breakdown) continue;
        list.push({
          studentName: finalResult.studentName,
          studentCode: finalResult.studentCode,
          className: finalResult.className,
          section: finalResult.section,
          academicYear: finalResult.academicYear,
          examName: breakdown.groupName,
          subjects: [],
          totalObtained: breakdown.totalObtained,
          totalMax: breakdown.totalMax,
          average: breakdown.average,
          grade: breakdown.grade,
          passed: breakdown.passed,
          group: { examColumns: breakdown.examColumns, subjectRows: breakdown.subjectRows },
        });
      } else {
        list.push({
          studentName: finalResult.studentName,
          studentCode: finalResult.studentCode,
          className: finalResult.className,
          section: finalResult.section,
          academicYear: finalResult.academicYear,
          examName: tr.examName,
          term: tr.term,
          subjects: tr.subjects,
          totalObtained: tr.totalObtained,
          totalMax: tr.totalMax,
          average: tr.average,
          grade: tr.grade,
          passed: tr.passed,
        });
      }
    }
    return list;
  }, [finalResult, termResults]);

  return (
    <main className="min-h-screen bg-secondary/30 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="mx-auto mb-4 h-14 w-14 rounded-2xl object-contain shadow-lg"
            />
          ) : (
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
              <GraduationCap className="h-7 w-7" />
            </span>
          )}
          <h1 className="text-2xl font-bold">{branding.name}</h1>
          <p className="text-sm text-muted-foreground">{branding.tagline}</p>
          <p className="mt-2 text-lg font-semibold">{t("results.studentResultsPortal")}</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <label className="mb-2 block text-sm font-medium">{t("results.enterStudentId")}</label>
          <div className="flex gap-2">
            <Input
              placeholder={t("results.eGShmm000001")}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setSearched(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
            />
            <Button onClick={() => void handleSearch()} disabled={loading}>
              <Search className="me-2 h-4 w-4" />
              {loading ? "Loading…" : "View Results"}
            </Button>
          </div>
        </div>

        {searched && notFound && (
          <p className="mt-6 text-center text-rose-600">{t("results.studentIdNotFound")}</p>
        )}

        {searched && blocked && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 dark:border-rose-900 dark:bg-rose-950/30">
            <p>{t("results.resultsAreBlockedPleaseContactThe")}</p>
            {blockedReason ? (
              <p className="mt-2 text-sm font-medium">
                {t("results.reason")}: {blockedReason}
              </p>
            ) : null}
          </div>
        )}

        {student && !blocked && (
          <div className="mt-6 space-y-6">
            {cards.map((data) => (
              <ExamResultCard key={data.examName + (data.term ?? "")} data={data} />
            ))}

            {termResults.length === 0 && (
              <p className="text-center text-muted-foreground">{t("results.noPublishedResultsYet")}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
