"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTeacherPortal } from "@/components/teacher-portal/portal-context";
import {
  apiTeacherPortalClassResults,
  type ClassResultsResponse,
} from "@/lib/teacher-portal/api";
import { toast } from "@/lib/toast";

export default function TeacherPortalResultsPage() {
  const { teacher, canViewStudents } = useTeacherPortal();
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [examId, setExamId] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ClassResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const yearOptions = useMemo(
    () =>
      [...new Map(teacher.assignments.map((a) => [a.academicYearId, a.academicYear.name])).entries()],
    [teacher.assignments],
  );

  const yearAssignments = useMemo(
    () => teacher.assignments.filter((a) => !yearId || a.academicYearId === yearId),
    [teacher.assignments, yearId],
  );

  const classes = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of yearAssignments) m.set(a.classId, a.class.name);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [yearAssignments]);

  const sections = useMemo(() => {
    if (!classId) return [];
    const assigned = yearAssignments.filter((a) => a.classId === classId);
    const hasAll = assigned.some((a) => a.sectionId === null);
    const named = [
      ...new Map(
        assigned
          .filter((a) => a.section)
          .map((a) => [a.sectionId!, a.section!.name]),
      ).entries(),
    ].map(([id, name]) => ({ id, name }));
    return hasAll ? named : named;
  }, [classId, yearAssignments]);

  useEffect(() => {
    if (!yearId && yearOptions[0]) setYearId(yearOptions[0][0]);
  }, [yearOptions, yearId]);

  useEffect(() => {
    if (!yearId || !classId || !sectionId) {
      setData(null);
      return;
    }
    setLoading(true);
    void apiTeacherPortalClassResults({
      academicYearId: yearId,
      classId,
      sectionId,
      examId: examId || undefined,
    })
      .then(setData)
      .catch(() => {
        setData(null);
        toast("Could not load results", "error");
      })
      .finally(() => setLoading(false));
  }, [yearId, classId, sectionId, examId]);

  function exportCsv() {
    if (!data?.rows.length) return;
    const header = [
      "Student Code",
      "Student Name",
      "Exam",
      "Subject",
      "Marks",
      "Max",
      "Percentage",
      "Grade",
    ];
    const lines = data.rows.map((r) =>
      [
        r.studentCode,
        r.studentName,
        r.examName,
        r.subjectName,
        r.marksObtained ?? "",
        r.maxMarks,
        r.percentage ?? "",
        r.grade,
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "class-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!canViewStudents) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border bg-card p-8 text-center">
        <h1 className="text-xl font-bold">Results require student access</h1>
        <p className="text-sm text-muted-foreground">
          The View Students permission must be granted before you can open class
          results. Contact your administrator.
        </p>
        <Link href="/teacher-portal" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const filteredRows = data?.rows.filter((r) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (
      r.studentName.toLowerCase().includes(needle) ||
      r.studentCode.toLowerCase().includes(needle) ||
      r.subjectName.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Published examination results for your assigned classes and subjects.
          </p>
        </div>
        {data?.rows.length ? (
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Academic Year
          </label>
          <Select value={yearId} onChange={(e) => { setYearId(e.target.value); setClassId(""); setSectionId(""); }}>
            <option value="">Select…</option>
            {[...new Map(yearAssignments.map((a) => [a.academicYearId, a.academicYear.name])).entries()].map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Class</label>
          <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }}>
            <option value="">Select…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Section</label>
          <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
            <option value="">Select…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Exam (optional)</label>
          <Select value={examId} onChange={(e) => setExamId(e.target.value)} disabled={!data?.exams.length}>
            <option value="">All exams</option>
            {data?.exams.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {data?.subjectSummaries.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.subjectSummaries.map((s) => (
            <div key={s.subjectId} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.subjectName}</p>
              <p className="text-2xl font-bold">{s.averagePercentage}%</p>
              <p className="text-sm text-muted-foreground">Grade {s.grade} · {s.studentCount} students</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search student or subject…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading results…</p>
      ) : !classId || !sectionId ? (
        <p className="text-muted-foreground">Select class and section to view results.</p>
      ) : !filteredRows?.length ? (
        <p className="text-muted-foreground">No published results for this selection.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Exam</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Marks</th>
                <th className="px-3 py-2 font-medium">%</th>
                <th className="px-3 py-2 font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={`${r.studentId}-${r.examId}-${r.subjectId}-${i}`} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.studentName}</p>
                    <p className="text-xs text-muted-foreground">{r.studentCode}</p>
                  </td>
                  <td className="px-3 py-2">{r.examName}</td>
                  <td className="px-3 py-2">{r.subjectName}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.marksObtained ?? "—"} / {r.maxMarks}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.percentage ?? "—"}</td>
                  <td className="px-3 py-2">{r.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
