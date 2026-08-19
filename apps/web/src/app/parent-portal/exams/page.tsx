"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortal, usePortalAudit } from "@/components/parent-portal/portal-context";
import { fetchChildExamResults } from "@/lib/parent-portal/store";
import { apiFetchPortalChildPhotoBlob } from "@/lib/parent-portal/api";
import { buildExamGroupBreakdown } from "@/lib/examinations/store";
import type { StudentExamResult } from "@/lib/examinations/types";
import { ExamResultCard, type ExamResultCardData } from "@/components/examinations/exam-result-card";

interface CardEntry {
  key: string;
  data: ExamResultCardData;
  /** Set on the combined card of a group — lets the parent expand its members below. */
  groupId?: string;
}

export default function ParentExamsPage() {
  const t = useT();
  const { selectedChild } = usePortal();
  usePortalAudit("RESULT_VIEWED", selectedChild?.id);

  const [blocked, setBlocked] = useState(false);
  const [results, setResults] = useState<StudentExamResult[]>([]);
  const [studentCode, setStudentCode] = useState("");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState<string | null>(null);
  const [finalGrade, setFinalGrade] = useState<string | null>(null);
  const [finalPassed, setFinalPassed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedChild) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setExpandedGroups(new Set());
    void fetchChildExamResults(selectedChild.id).then((data) => {
      setBlocked(data.blocked);
      setResults(data.results);
      setStudentCode(data.studentCode ?? selectedChild.code);
      setClassName(data.className ?? selectedChild.className);
      setSection(data.section ?? selectedChild.section ?? null);
      setFinalGrade(data.finalGrade ?? null);
      setFinalPassed(data.passed ?? null);
      setLoading(false);
    });
  }, [selectedChild]);

  // Local storage backends can't hand out a direct photo URL, so fetch the
  // bytes through the authenticated portal proxy per selected child.
  useEffect(() => {
    if (!selectedChild) {
      setPhotoUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    void apiFetchPortalChildPhotoBlob(selectedChild.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch(() => setPhotoUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedChild]);

  function toggleExpanded(groupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const baseInfo = {
    studentName: selectedChild?.fullName ?? "",
    studentPhotoUrl: photoUrl ?? selectedChild?.photoUrl ?? null,
    studentCode,
    className,
    section,
  };

  // One combined card per exam group (weighted, matching what the school
  // publishes as the term result), one card per standalone exam — same
  // shape and print/QR behaviour the student-facing lookup page uses.
  const cards = useMemo<CardEntry[]>(() => {
    const seenGroups = new Set<string>();
    const entries: CardEntry[] = [];
    for (const r of results) {
      if (r.examGroupId) {
        if (seenGroups.has(r.examGroupId)) continue;
        seenGroups.add(r.examGroupId);
        const breakdown = buildExamGroupBreakdown({ termResults: results }, r.examGroupId);
        if (!breakdown) continue;
        entries.push({
          key: `group-${r.examGroupId}`,
          groupId: r.examGroupId,
          data: {
            ...baseInfo,
            examName: breakdown.groupName,
            subjects: [],
            totalObtained: breakdown.totalObtained,
            totalMax: breakdown.totalMax,
            average: breakdown.average,
            grade: breakdown.grade,
            passed: breakdown.passed,
            group: { examColumns: breakdown.examColumns, subjectRows: breakdown.subjectRows },
          },
        });
      } else {
        entries.push({
          key: `exam-${r.examId}`,
          data: {
            ...baseInfo,
            examName: r.examName,
            term: r.term,
            subjects: r.subjects,
            totalObtained: r.totalObtained,
            totalMax: r.totalMax,
            average: r.average,
            grade: r.grade,
            passed: r.passed,
          },
        });
      }
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, studentCode, className, section]);

  function groupMemberCards(groupId: string): CardEntry[] {
    return results
      .filter((r) => r.examGroupId === groupId)
      .map((r) => ({
        key: `exam-${r.examId}`,
        data: {
          ...baseInfo,
          examName: r.examName,
          term: r.term,
          subjects: r.subjects,
          totalObtained: r.totalObtained,
          totalMax: r.totalMax,
          average: r.average,
          grade: r.grade,
          passed: r.passed,
        },
      }));
  }

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

      {cards.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          {t("parentPortalExams.noPublishedExaminationResultsYet")}
        </div>
      )}

      {cards.map((entry) => {
        const expanded = entry.groupId ? expandedGroups.has(entry.groupId) : false;
        const members = entry.groupId && expanded ? groupMemberCards(entry.groupId) : [];
        return (
          <div key={entry.key} className="space-y-3">
            <ExamResultCard data={entry.data} />
            {entry.groupId && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => toggleExpanded(entry.groupId!)}
                >
                  {expanded ? (
                    <ChevronUp className="me-1.5 h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="me-1.5 h-3.5 w-3.5" />
                  )}
                  {expanded
                    ? t("parentPortalExams.hideIndividualExams")
                    : t("parentPortalExams.viewIndividualExams")}
                </Button>
              </div>
            )}
            {members.length > 0 && (
              <div className="space-y-3 border-s-2 border-dashed ps-4">
                {members.map((m) => (
                  <ExamResultCard key={m.key} data={m.data} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
