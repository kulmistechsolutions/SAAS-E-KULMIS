"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { MonitoringClassTable } from "@/components/examinations/monitoring-class-table";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import {
  apiListExams,
  apiMonitoringClasses,
  type ApiExam,
  type ApiMonitoringClassOverview,
} from "@/lib/examinations/api";
import {
  activeAcademicYear,
  ensureAcademicsLoaded,
  getAcademicsState,
} from "@/lib/academics/store";

export default function ExamMonitoringPage() {
  const [mounted, setMounted] = useState(false);
  const [yearName, setYearName] = useState("");
  const [examId, setExamId] = useState("");
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [rows, setRows] = useState<ApiMonitoringClassOverview[]>([]);
  const [loading, setLoading] = useState(true);

  const yearId = useMemo(() => {
    const name = yearName || activeAcademicYear();
    return getAcademicsState().academicYears.find((y) => y.name === name)?.id;
  }, [yearName]);

  useEffect(() => {
    void ensureAcademicsLoaded();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void apiListExams(yearId ? { academicYearId: yearId } : undefined)
      .then(setExams)
      .catch(() => setExams([]));
  }, [mounted, yearId]);

  useEffect(() => {
    if (!mounted) return;
    setLoading(true);
    void apiMonitoringClasses({
      academicYearId: yearId,
      examId: examId || undefined,
    })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [mounted, yearId, examId]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Exam Monitoring</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor teacher submissions by class. Open a class to see subject-level
            progress and send reminders.
          </p>
        </div>
        <Link
          href="/sms"
          className="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Send SMS
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Academic Year
          </label>
          <AcademicYearSelect value={yearName} onChange={setYearName} />
        </div>
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Exam (optional)
          </label>
          <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">All examinations</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.class.name} {e.section?.name ?? ""}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center rounded-2xl border bg-card py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <MonitoringClassTable
          rows={rows}
          examId={examId || undefined}
          academicYear={yearName || activeAcademicYear()}
        />
      )}
    </div>
  );
}
