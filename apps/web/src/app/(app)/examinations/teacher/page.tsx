"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { MarkEntryTable } from "@/components/examinations/mark-entry-table";
import { ExamStatusBadge } from "@/components/examinations/exam-status-badge";
import {
  getExam,
  teacherExams,
  teacherSubjectsForExam,
} from "@/lib/examinations/store";
import { getTeachersState } from "@/lib/teachers/store";
import { useAuth } from "@/lib/auth";

export default function TeacherExamPortalPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [examId, setExamId] = useState("");
  const [subject, setSubject] = useState("");

  const teachers = getTeachersState().teachers;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (teachers.length > 0 && !teacherId) setTeacherId(teachers[0].id);
  }, [teachers, teacherId]);

  const assignedExams = useMemo(
    () => (teacherId ? teacherExams(teacherId) : []),
    [teacherId],
  );
  const exam = examId ? getExam(examId) : undefined;
  const subjects = useMemo(
    () => (teacherId && examId ? teacherSubjectsForExam(teacherId, examId) : []),
    [teacherId, examId],
  );

  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(subject)) {
      setSubject(subjects[0]);
    }
  }, [subjects, subject]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teacher Exam Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teachers see only assigned class, section, and subject examinations.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Teacher (demo)</label>
          <Select value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setExamId(""); }}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.fullName}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Exam</label>
          <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select exam…</option>
            {assignedExams.map((e) => (
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

      {exam && (
        <div className="flex items-center gap-2 text-sm">
          <ExamStatusBadge status={exam.status} />
          <span className="text-muted-foreground">
            Logged in as {user?.username ?? "teacher"} — assigned subjects only
          </span>
        </div>
      )}

      {mounted && exam && subject && (
        <MarkEntryTable
          exam={exam}
          subject={subject}
          enteredBy={teachers.find((t) => t.id === teacherId)?.fullName ?? "Teacher"}
          role="TEACHER"
        />
      )}

      {assignedExams.length === 0 && teacherId && (
        <p className="text-center text-muted-foreground">No examinations assigned to this teacher.</p>
      )}
    </div>
  );
}
