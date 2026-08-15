"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiStudentPortalResults, type StudentPortalResults } from "@/lib/student-portal/api";
import { buildExamGroupBreakdown } from "@/lib/examinations/store";
import type { StudentExamResult } from "@/lib/examinations/types";
import { ExamResultCard, type ExamResultCardData } from "@/components/examinations/exam-result-card";

interface CardEntry {
  key: string;
  data: ExamResultCardData;
  groupId?: string;
}

export default function StudentPortalResultsPage() {
  const [data, setData] = useState<StudentPortalResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    void apiStudentPortalResults()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const results: StudentExamResult[] = data?.termResults ?? [];
  const baseInfo = useMemo(
    () => ({
      studentName: data?.studentName ?? "",
      studentCode: data?.studentCode ?? "",
      className: data?.className ?? "",
      section: data?.section ?? null,
    }),
    [data],
  );

  function toggleExpanded(groupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

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
  }, [results, baseInfo]);

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

  if (loading) {
    return <p className="text-muted-foreground">Loading results…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exam Results</h1>
        <p className="mt-1 text-sm text-muted-foreground">Published results only.</p>
      </div>

      {data && data.finalGrade && results.length > 1 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Final Academic Result</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Grade {data.finalGrade} · {data.passed ? "Pass" : "Fail"}
          </p>
        </div>
      )}

      {cards.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No published examination results yet.
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
                  {expanded ? "Hide individual exams" : "View individual exams"}
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
