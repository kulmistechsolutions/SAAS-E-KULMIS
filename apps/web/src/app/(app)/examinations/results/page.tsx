"use client";

import { useEffect, useMemo, useState } from "react";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { ResultsClassTable } from "@/components/examinations/results-class-table";
import {
  apiResultsClasses,
  type ApiResultsClassOverview,
} from "@/lib/examinations/api";
import {
  activeAcademicYear,
  ensureAcademicsLoaded,
  getAcademicsState,
} from "@/lib/academics/store";

export default function ExamResultsPage() {
  const [mounted, setMounted] = useState(false);
  const [yearName, setYearName] = useState("");
  const [rows, setRows] = useState<ApiResultsClassOverview[]>([]);
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
    setLoading(true);
    void apiResultsClasses(yearId)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [mounted, yearId]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Results & Publishing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage results by class. Teacher lock and student portal publishing are
          controlled separately per examination.
        </p>
      </div>

      <div className="max-w-xs rounded-xl border bg-card p-4">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Academic Year
        </label>
        <AcademicYearSelect value={yearName} onChange={setYearName} />
      </div>

      {loading ? (
        <div className="flex justify-center rounded-2xl border bg-card py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <ResultsClassTable
          rows={rows}
          academicYear={yearName || activeAcademicYear()}
        />
      )}
    </div>
  );
}
