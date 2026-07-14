"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MarkEntryTable } from "@/components/examinations/mark-entry-table";
import { ExamStatusBadge } from "@/components/examinations/exam-status-badge";
import { apiListExams, apiSubmitExamSubject, type ApiExam } from "@/lib/examinations/api";
import {
  getExam,
  loadExamMarks,
  refreshExaminations,
} from "@/lib/examinations/store";
import { loadTeacherMe } from "@/lib/teachers/session";
import type { TeacherMe } from "@/lib/teachers/api";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { sectionsForClass, useAcademicsState } from "@/lib/academics/store";

/**
 * PRD exam workflow for teachers:
 * Academic Year → Class → Section (required even if assigned "All") → Exam → Subject
 * Then Manual Entry or Excel/CSV import via MarkEntryTable.
 */
export default function TeacherExamPortalPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const academics = useAcademicsState();
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [meError, setMeError] = useState(false);
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [year, setYear] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [examId, setExamId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    void Promise.all([
      loadTeacherMe().catch(() => {
        setMeError(true);
        return null;
      }),
      apiListExams().catch(() => [] as ApiExam[]),
      refreshExaminations(),
    ]).then(([teacher, list]) => {
      if (teacher) setMe(teacher);
      setExams(list);
      const years = teacher
        ? [...new Set(teacher.assignments.map((a) => a.academicYear.name))]
        : [];
      if (years[0]) setYear(years[0]);
    });
  }, [mounted]);

  const yearAssignments = useMemo(() => {
    if (!me) return [];
    return me.assignments.filter((a) => !year || a.academicYear.name === year);
  }, [me, year]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of yearAssignments) map.set(a.classId, a.class.name);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [yearAssignments]);

  const selectedClass = classOptions.find((c) => c.id === classId);

  const sectionOptions = useMemo(() => {
    if (!classId || !me) return [];
    const assigned = yearAssignments.filter((a) => a.classId === classId);
    const hasAll = assigned.some((a) => a.sectionId === null);
    const named = [
      ...new Set(
        assigned
          .map((a) => a.section)
          .filter((s): s is { id: string; name: string } => Boolean(s))
          .map((s) => `${s.id}|${s.name}`),
      ),
    ].map((pair) => {
      const [id, name] = pair.split("|");
      return { id: id!, name: name! };
    });
    if (hasAll) {
      const cls = academics.classes.find((c) => c.id === classId);
      if (cls) {
        return sectionsForClass(cls.id).map((s) => ({ id: s.id, name: s.name }));
      }
    }
    return named;
  }, [classId, me, yearAssignments, academics.classes]);

  const examOptions = useMemo(() => {
    if (!classId || !sectionId) return [];
    return exams.filter((e) => {
      if (year && e.academicYear.name !== year) return false;
      if (e.classId !== classId) return false;
      // Exam for all sections OR exact section match
      if (e.sectionId && e.sectionId !== sectionId) return false;
      // Must include at least one assigned subject for this class/section
      return yearAssignments.some(
        (a) =>
          a.classId === classId &&
          (a.sectionId === null || a.sectionId === sectionId) &&
          e.subjects.some((s) => s.subjectId === a.subjectId || s.subject.name === a.subject.name),
      );
    });
  }, [exams, classId, sectionId, year, yearAssignments]);

  const storeExam = examId ? getExam(examId) : undefined;

  const subjectOptions = useMemo(() => {
    if (!me || !examId || !classId) return [];
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return [];
    return exam.subjects
      .filter((es) =>
        yearAssignments.some(
          (a) =>
            a.classId === classId &&
            (a.sectionId === null || a.sectionId === sectionId) &&
            (a.subjectId === es.subjectId || a.subject.name === es.subject.name),
        ),
      )
      .map((es) => ({ id: es.subjectId, name: es.subject.name }));
  }, [me, examId, exams, classId, sectionId, yearAssignments]);

  useEffect(() => {
    if (classId && !classOptions.some((c) => c.id === classId)) {
      setClassId("");
      setSectionId("");
      setExamId("");
      setSubjectName("");
      setSubjectId("");
    }
  }, [classOptions, classId]);

  useEffect(() => {
    if (sectionId && !sectionOptions.some((s) => s.id === sectionId)) {
      setSectionId("");
      setExamId("");
      setSubjectName("");
      setSubjectId("");
    }
  }, [sectionOptions, sectionId]);

  useEffect(() => {
    if (examId && !examOptions.some((e) => e.id === examId)) {
      setExamId("");
      setSubjectName("");
      setSubjectId("");
    }
  }, [examOptions, examId]);

  useEffect(() => {
    if (subjectOptions.length && !subjectOptions.some((s) => s.name === subjectName)) {
      setSubjectName(subjectOptions[0]!.name);
      setSubjectId(subjectOptions[0]!.id);
    }
  }, [subjectOptions, subjectName]);

  useEffect(() => {
    if (examId) void loadExamMarks(examId);
  }, [examId]);

  // Prefer store exam (has section name string) for MarkEntryTable; synthesize if needed
  const markExam = useMemo(() => {
    if (storeExam) {
      const secName =
        sectionOptions.find((s) => s.id === sectionId)?.name ?? storeExam.section;
      return { ...storeExam, section: secName };
    }
    const apiExam = exams.find((e) => e.id === examId);
    if (!apiExam) return undefined;
    const secName =
      sectionOptions.find((s) => s.id === sectionId)?.name ??
      apiExam.section?.name ??
      "";
    return {
      id: apiExam.id,
      name: apiExam.name,
      academicYear: apiExam.academicYear.name,
      examGroupId: apiExam.examGroupId,
      examType: apiExam.examType,
      term: apiExam.term,
      maxMarks: apiExam.maxMarks,
      weightPercent: apiExam.weightPercent,
      startDate: apiExam.startDate.slice(0, 10),
      endDate: apiExam.endDate.slice(0, 10),
      status: apiExam.status,
      className: apiExam.class.name,
      section: secName,
      subjects: apiExam.subjects.map((s) => s.subject.name),
      createdAt: apiExam.createdAt,
      createdBy: apiExam.createdByUserId ?? "System",
    };
  }, [storeExam, exams, examId, sectionId, sectionOptions]);

  async function handleSubmit() {
    if (!examId || !subjectId) return;
    setSubmitting(true);
    try {
      await apiSubmitExamSubject(examId, subjectId);
      toast("Marks submitted — editing locked until admin unlocks", "success");
    } catch {
      toast("Could not submit marks", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  if (isTeacher && !me) {
    return (
      <div className="space-y-3 py-16 text-center text-muted-foreground">
        <p>
          {meError
            ? "Could not load your teaching assignments. Check your connection and try again."
            : "Loading teacher assignments…"}
        </p>
        {meError && (
          <Button
            variant="outline"
            onClick={() => {
              setMeError(false);
              void loadTeacherMe(true)
                .then((teacher) => {
                  setMe(teacher);
                  const years = [
                    ...new Set(teacher.assignments.map((a) => a.academicYear.name)),
                  ];
                  if (years[0]) setYear(years[0]);
                })
                .catch(() => {
                  setMeError(true);
                  toast("Could not load teacher assignments", "error");
                });
            }}
          >
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enter Marks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select Academic Year → Class → Section → Exam → Subject. Students from
          different sections never appear together.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Academic Year
          </label>
          <Select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setClassId("");
              setSectionId("");
              setExamId("");
            }}
          >
            <option value="">Select year…</option>
            {[...new Set(me?.assignments.map((a) => a.academicYear.name) ?? [])].map(
              (y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ),
            )}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Class
          </label>
          <Select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
              setExamId("");
            }}
            disabled={!year}
          >
            <option value="">Select class…</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Section <span className="text-rose-500">*</span>
          </label>
          <Select
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setExamId("");
            }}
            disabled={!classId}
          >
            <option value="">Select section…</option>
            {sectionOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {classId && sectionOptions.length === 0 && (
            <p className="mt-1 text-[11px] text-amber-600">
              No sections available for this class assignment.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Exam
          </label>
          <Select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            disabled={!sectionId}
          >
            <option value="">Select exam…</option>
            {examOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.status})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Subject
          </label>
          <Select
            value={subjectName}
            onChange={(e) => {
              const name = e.target.value;
              setSubjectName(name);
              setSubjectId(
                subjectOptions.find((s) => s.name === name)?.id ?? "",
              );
            }}
            disabled={!examId}
          >
            <option value="">Select subject…</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {markExam && subjectName && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <ExamStatusBadge status={markExam.status} />
          <span className="text-muted-foreground">
            {selectedClass?.name} · Section{" "}
            {sectionOptions.find((s) => s.id === sectionId)?.name} · {subjectName}
            {me ? ` · ${me.fullName}` : ""}
          </span>
          <Button
            className="ml-auto h-9"
            disabled={
              submitting ||
              ["LOCKED", "PUBLISHED", "ARCHIVED"].includes(markExam.status)
            }
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Submitting…" : "Submit marks"}
          </Button>
        </div>
      )}

      {markExam && subjectName && (
        <MarkEntryTable
          exam={markExam}
          subject={subjectName}
          subjectId={subjectId}
          enteredBy={me?.fullName ?? "Teacher"}
          role="TEACHER"
        />
      )}

      {sectionId && examOptions.length === 0 && (
        <p className="text-center text-muted-foreground">
          No examinations for this class and section.
        </p>
      )}
    </div>
  );
}
