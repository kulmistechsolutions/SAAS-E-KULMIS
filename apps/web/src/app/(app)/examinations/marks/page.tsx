"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { MarkEntryTable } from "@/components/examinations/mark-entry-table";
import { getExam, useExaminationsState } from "@/lib/examinations/store";
import { ACADEMIC_YEARS } from "@/lib/students/constants";

export default function MarksEntryPage() {
  const [mounted, setMounted] = useState(false);
  const params = useSearchParams();
  const state = useExaminationsState();
  const [year, setYear] = useState("");
  const [examId, setExamId] = useState("");
  const [subject, setSubject] = useState("");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const qExam = params.get("exam");
    if (qExam) setExamId(qExam);
    setYear(state.exams[0]?.academicYear ?? ACADEMIC_YEARS[0]);
  }, [mounted, params, state.exams]);

  const exams = useMemo(
    () => state.exams.filter((e) => !year || e.academicYear === year),
    [state.exams, year],
  );
  const exam = examId ? getExam(examId) : undefined;
  const subjects = exam?.subjects ?? [];

  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(subject)) {
      setSubject(subjects[0]);
    }
  }, [subjects, subject]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enter Marks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manual entry or Excel import. Students are sorted A–Z per section.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Academic Year</label>
          <Select value={year} onChange={(e) => setYear(e.target.value)}>
            {ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Exam</label>
          <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select exam…</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.className} {e.section}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Subject</label>
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!exam}>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
      </div>

      {mounted && exam && subject && (
        <MarkEntryTable exam={exam} subject={subject} />
      )}
    </div>
  );
}
