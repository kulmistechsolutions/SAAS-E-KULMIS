"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileText,
  Lock,
  Pencil,
  Printer,
  Send,
  Unlock,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  ExamResultCard,
  subjectGrade,
} from "@/components/examinations/exam-result-card";
import {
  apiClassResultsMatrix,
  apiDownloadClassResultsExcel,
  apiDownloadClassResultsPdf,
  apiMonitoringClassDetail,
  apiResultsClasses,
  apiSetStudentPortal,
  apiSetTeacherLock,
  apiUpsertMarks,
  type ApiClassResultsMatrix,
} from "@/lib/examinations/api";
import {
  ensureAcademicsLoaded,
  getAcademicsState,
} from "@/lib/academics/store";
import { toast } from "@/lib/toast";

type SortKey = "name" | "total" | "average" | "grade";

export default function ClassResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading results…
        </div>
      }
    >
      <ClassResultsContent />
    </Suspense>
  );
}

function ClassResultsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = params.classId as string;
  const yearName = searchParams.get("year") ?? "";

  const [examId, setExamId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [topN, setTopN] = useState<"all" | "3" | "5" | "10">("all");
  const [data, setData] = useState<ApiClassResultsMatrix | null>(null);
  const [classMeta, setClassMeta] = useState<{
    className: string;
    exams: {
      id: string;
      name: string;
      status: string;
      section: string | null;
    }[];
  } | null>(null);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [cardStudentId, setCardStudentId] = useState<string | null>(null);

  const yearId = useMemo(() => {
    return getAcademicsState().academicYears.find((y) => y.name === yearName)
      ?.id;
  }, [yearName]);

  useEffect(() => {
    void ensureAcademicsLoaded().then(() => {
      void apiResultsClasses(yearId).then((rows) => {
        const row = rows.find((r) => r.classId === classId);
        if (row) {
          setClassMeta({ className: row.className, exams: row.exams });
          if (!examId && row.exams[0]) setExamId(row.exams[0].id);
        }
      });
      void apiMonitoringClassDetail(classId, { academicYearId: yearId }).then(
        (detail) => setSections(detail.sections),
      );
    });
  }, [classId, yearId, examId]);

  const loadMatrix = useCallback(() => {
    if (!examId) return;
    setLoading(true);
    void apiClassResultsMatrix({
      classId,
      examId,
      sectionId: sectionId || undefined,
      search: search.trim() || undefined,
      sortBy,
      sortDir,
    })
      .then((res) => {
        setData(res);
        setEditMode(false);
        setDraft({});
      })
      .catch(() => {
        setData(null);
        toast("Could not load results", "error");
      })
      .finally(() => setLoading(false));
  }, [classId, examId, sectionId, search, sortBy, sortDir]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const incompleteRows = useMemo(
    () => data?.rows.filter((r) => !r.complete) ?? [],
    [data],
  );

  // Rank is the class position by total marks, highest first, and it stays put
  // no matter how the table is sorted — a student is 1st in the class whether
  // you're viewing A→Z or by grade. Equal totals share a rank (1,2,2,4).
  const rankByStudent = useMemo(() => {
    const map = new Map<string, number>();
    if (!data) return map;
    const ordered = [...data.rows].sort(
      (a, b) => b.totalObtained - a.totalObtained,
    );
    let rank = 0;
    let prevTotal: number | null = null;
    ordered.forEach((r, i) => {
      if (prevTotal === null || r.totalObtained !== prevTotal) rank = i + 1;
      map.set(r.studentId, rank);
      prevTotal = r.totalObtained;
    });
    return map;
  }, [data]);

  // The rows actually shown: the server already sorted/searched them; "Top N"
  // narrows to the best performers by rank without disturbing that order.
  const visibleRows = useMemo(() => {
    const rows = data?.rows ?? [];
    if (topN === "all") return rows;
    const limit = Number(topN);
    return rows.filter((r) => (rankByStudent.get(r.studentId) ?? 999) <= limit);
  }, [data, topN, rankByStudent]);

  /** The selected row, normalized into the shared result-card shape. */
  const cardData = useMemo(() => {
    if (!data || !cardStudentId) return null;
    const row = data.rows.find((r) => r.studentId === cardStudentId);
    if (!row) return null;
    return {
      studentName: row.studentName,
      studentCode: row.studentCode,
      className: data.exam.className,
      section: data.exam.sectionName,
      academicYear: data.exam.academicYear,
      examName: data.exam.name,
      subjects: data.subjects.map((s) => {
        const marks = row.subjectMarks[s.subjectId] ?? null;
        return {
          subject: s.name,
          maxMarks: data.exam.maxMarks,
          marksObtained: marks,
          grade: subjectGrade(marks, data.exam.maxMarks),
        };
      }),
      totalObtained: row.totalObtained,
      totalMax: row.totalMax,
      average: row.average,
      grade: row.grade,
      passed: row.passed,
    };
  }, [data, cardStudentId]);

  function handleMarkDraft(studentId: string, subjectId: string, raw: string) {
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    if (raw !== "" && data && Number(raw) > data.exam.maxMarks) return;
    setDraft((d) => ({
      ...d,
      [studentId]: { ...(d[studentId] ?? {}), [subjectId]: raw },
    }));
  }

  function markValue(
    studentId: string,
    subjectId: string,
    current: number | null,
  ) {
    const d = draft[studentId]?.[subjectId];
    if (d !== undefined) return d;
    return current != null ? String(current) : "";
  }

  async function handleSaveEdits() {
    if (!data || !examId) return;
    const records: {
      studentId: string;
      subjectId: string;
      marks: number | null;
    }[] = [];
    for (const row of data.rows) {
      for (const sub of data.subjects) {
        const raw = markValue(
          row.studentId,
          sub.subjectId,
          row.subjectMarks[sub.subjectId] ?? null,
        );
        if (draft[row.studentId]?.[sub.subjectId] === undefined) continue;
        records.push({
          studentId: row.studentId,
          subjectId: sub.subjectId,
          marks: raw === "" ? null : Number(raw),
        });
      }
    }
    if (records.length === 0) {
      toast("No changes to save", "error");
      return;
    }
    setSaving(true);
    try {
      await apiUpsertMarks({ examId, records });
      toast("Marks saved and totals recalculated", "success");
      loadMatrix();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTeacherLock() {
    if (!data) return;
    setActionBusy(true);
    try {
      await apiSetTeacherLock(data.exam.id, !data.exam.teacherLocked);
      toast(
        data.exam.teacherLocked ? "Teachers unlocked" : "Teacher lock enabled",
        "success",
      );
      loadMatrix();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setActionBusy(false);
    }
  }

  async function toggleStudentPortal() {
    if (!data) return;
    setActionBusy(true);
    try {
      await apiSetStudentPortal(data.exam.id, !data.exam.studentPortalOpen);
      toast(
        data.exam.studentPortalOpen
          ? "Results hidden from student portal"
          : "Results published to student portal",
        "success",
      );
      loadMatrix();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setActionBusy(false);
    }
  }

  function exportCsv() {
    if (!data) return;
    const headers = [
      "Student ID",
      "Student Name",
      ...data.subjects.map((s) => s.name),
      "Total",
      "Average",
      "Grade",
      "Remark",
    ];
    const lines = data.rows.map((r) =>
      [
        r.studentCode,
        r.studentName,
        ...data.subjects.map((s) => r.subjectMarks[s.subjectId] ?? ""),
        r.totalObtained,
        r.average,
        r.grade,
        r.remark,
      ].join(","),
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.exam.name}-${data.exam.className}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  async function downloadExport(kind: "pdf" | "xlsx") {
    if (!examId) return;
    setExportBusy(true);
    try {
      const opts = {
        classId,
        examId,
        sectionId: sectionId || undefined,
        search: search.trim() || undefined,
        sortBy,
        sortDir,
      };
      const { blob, filename } =
        kind === "pdf"
          ? await apiDownloadClassResultsPdf(opts)
          : await apiDownloadClassResultsExcel(opts);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast(`${kind === "pdf" ? "PDF" : "Excel"} downloaded`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExportBusy(false);
    }
  }

  const className = classMeta?.className ?? data?.exam.className ?? "Class";

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-start gap-4 print:hidden">
        <Button asChild variant="ghost" className="h-9 px-2">
          <Link href="/examinations/results">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{className} — Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View, edit, publish, and export class results. Sections are never
            mixed.
          </p>
        </div>
        {data && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-9"
              disabled={actionBusy}
              onClick={() => void toggleTeacherLock()}
            >
              {data.exam.teacherLocked ? (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  Unlock Teachers
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Teacher Lock
                </>
              )}
            </Button>
            <Button
              className="h-9"
              disabled={actionBusy}
              onClick={() => void toggleStudentPortal()}
            >
              <Send className="mr-2 h-4 w-4" />
              {data.exam.studentPortalOpen
                ? "Unpublish Portal"
                : "Publish Portal"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 print:hidden sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Academic Year
          </label>
          <Input
            value={yearName || (data?.exam.academicYear ?? "")}
            readOnly
            className="h-9"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Exam
          </label>
          <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select exam…</option>
            {(classMeta?.exams ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} {e.section ? `(${e.section})` : ""} — {e.status}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Section
          </label>
          <Select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">All / exam default</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Search Student
          </label>
          <Input
            className="h-9"
            placeholder="ID or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Sort
          </label>
          <div className="flex gap-2">
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-9"
            >
              <option value="name">Name</option>
              <option value="total">Total</option>
              <option value="average">Average</option>
              <option value="grade">Grade</option>
            </Select>
            <Select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
              className="h-9 w-24"
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </Select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Show
          </label>
          <Select
            value={topN}
            onChange={(e) => setTopN(e.target.value as typeof topN)}
            className="h-9"
          >
            <option value="all">All students</option>
            <option value="3">Top 3</option>
            <option value="5">Top 5</option>
            <option value="10">Top 10</option>
          </Select>
        </div>
      </div>

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total Students" value={data.summary.totalStudents} />
            <Stat
              label="Completed"
              value={data.summary.completed}
              tone="success"
            />
            <Stat
              label="Incomplete"
              value={data.summary.incomplete}
              tone="warning"
            />
            <Stat
              label="Completion"
              value={`${data.summary.completionPercent}%`}
            />
          </div>

          {incompleteRows.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
              <p className="font-semibold">Missing marks detected</p>
              <ul className="mt-2 space-y-1">
                {incompleteRows.slice(0, 5).map((r) => (
                  <li key={r.studentId}>
                    {r.studentName} ({r.studentCode}) — missing:{" "}
                    {r.missingSubjects.join(", ")}
                  </li>
                ))}
                {incompleteRows.length > 5 && (
                  <li>…and {incompleteRows.length - 5} more students</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant={editMode ? "default" : "outline"}
              className="h-9"
              onClick={() => setEditMode((v) => !v)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {editMode ? "Edit Mode On" : "Enable Edit Mode"}
            </Button>
            {editMode && (
              <Button
                className="h-9"
                disabled={saving}
                onClick={() => void handleSaveEdits()}
              >
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            )}
            <Button variant="outline" className="h-9" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              CSV Export
            </Button>
            <Button
              variant="outline"
              className="h-9"
              disabled={exportBusy || !examId}
              onClick={() => void downloadExport("pdf")}
            >
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              className="h-9"
              disabled={exportBusy || !examId}
              onClick={() => void downloadExport("xlsx")}
            >
              <Download className="mr-2 h-4 w-4" />
              Excel Export
            </Button>
            <Button variant="outline" className="h-9" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>

          <div className="hidden print:block">
            <h2 className="text-lg font-bold">
              {data.exam.name} — {data.exam.className}
              {data.exam.sectionName
                ? ` · Section ${data.exam.sectionName}`
                : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              {data.exam.academicYear} · {new Date().toLocaleDateString()}
            </p>
          </div>
        </>
      )}

      {loading ? (
        <div className="flex justify-center rounded-2xl border bg-card py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : data ? (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Rank</th>
                  <th className="px-3 py-2.5 font-medium">Student ID</th>
                  <th className="px-3 py-2.5 font-medium">Student Name</th>
                  {data.subjects.map((s) => (
                    <th key={s.subjectId} className="px-3 py-2.5 font-medium">
                      {s.name}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-medium">Total</th>
                  <th className="px-3 py-2.5 font-medium">Average</th>
                  <th className="px-3 py-2.5 font-medium">Grade</th>
                  <th className="px-3 py-2.5 font-medium">Remark</th>
                  <th className="px-3 py-2.5 text-right font-medium print:hidden">
                    Card
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr
                    key={r.studentId}
                    className={`border-t ${!r.complete ? "bg-amber-50/50" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <RankBadge rank={rankByStudent.get(r.studentId)} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.studentCode}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.studentName}</td>
                    {data.subjects.map((s) => (
                      <td key={s.subjectId} className="px-3 py-2 tabular-nums">
                        {editMode ? (
                          <Input
                            className="h-7 w-16 px-1 text-center text-xs"
                            value={markValue(
                              r.studentId,
                              s.subjectId,
                              r.subjectMarks[s.subjectId] ?? null,
                            )}
                            onChange={(e) =>
                              handleMarkDraft(
                                r.studentId,
                                s.subjectId,
                                e.target.value,
                              )
                            }
                          />
                        ) : (
                          (r.subjectMarks[s.subjectId] ?? "—")
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 tabular-nums font-medium">
                      {r.totalObtained}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {r.average.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 font-semibold">{r.grade}</td>
                    <td className="px-3 py-2">
                      <Badge
                        tone={
                          r.passed
                            ? "success"
                            : r.remark === "—"
                              ? "muted"
                              : "danger"
                        }
                      >
                        {r.remark}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right print:hidden">
                      <button
                        type="button"
                        onClick={() => setCardStudentId(r.studentId)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={data.subjects.length + 7}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No students match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-center text-muted-foreground">
          Select an exam to view results.
        </p>
      )}

      <Dialog
        open={!!cardData}
        onClose={() => setCardStudentId(null)}
        title="Exam Result Card"
        className="sm:max-w-3xl"
      >
        {cardData ? <ExamResultCard data={cardData} /> : null}
      </Dialog>
    </div>
  );
}

/** Class position. Top three get a medal tint; everyone else a plain number. */
function RankBadge({ rank }: { rank: number | undefined }) {
  if (!rank) return <span className="text-muted-foreground">—</span>;
  const medal =
    rank === 1
      ? "bg-amber-100 text-amber-800 ring-amber-300"
      : rank === 2
        ? "bg-slate-100 text-slate-700 ring-slate-300"
        : rank === 3
          ? "bg-orange-100 text-orange-800 ring-orange-300"
          : "";
  if (!medal) {
    return <span className="tabular-nums text-muted-foreground">{rank}</span>;
  }
  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ring-1 ${medal}`}
    >
      {rank}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning";
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === "success"
            ? "text-emerald-600"
            : tone === "warning"
              ? "text-amber-600"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
