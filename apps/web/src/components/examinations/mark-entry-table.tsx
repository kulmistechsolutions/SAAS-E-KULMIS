"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getExaminationsState,
  loadExamMarks,
  saveMarks,
  useExaminationsState,
} from "@/lib/examinations/store";
import {
  apiDownloadMarksTemplate,
  apiExamRoster,
  apiImportMarks,
} from "@/lib/examinations/api";
import { getAcademicsState } from "@/lib/academics/store";
import type { Exam } from "@/lib/examinations/types";
import { getState as getStudentsState } from "@/lib/students/store";
import { toast } from "@/lib/toast";

interface RosterStudent {
  id: string;
  code: string;
  fullName: string;
}

interface MarkEntryTableProps {
  exam: Exam;
  subject: string;
  /** When set (teacher portal), avoids academics API which teachers cannot access. */
  subjectId?: string;
  enteredBy?: string;
  role?: string;
}

export function MarkEntryTable({
  exam,
  subject,
  subjectId: subjectIdProp,
  enteredBy = "Admin User",
  role = "ADMINISTRATOR",
}: MarkEntryTableProps) {
  const isTeacher = role === "TEACHER";
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(isTeacher);

  const adminStudents = useMemo(() => {
    if (isTeacher) return [];
    return getStudentsState()
      .students.filter(
        (s) =>
          s.status === "ACTIVE" &&
          s.academicYear === exam.academicYear &&
          s.className === exam.className &&
          (s.section ?? "") === exam.section,
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((s) => ({ id: s.id, code: s.code, fullName: s.fullName }));
  }, [exam, isTeacher]);

  const students = isTeacher ? roster : adminStudents;

  const examMarks = useExaminationsState().marks;
  const serverMarksKey = useMemo(
    () =>
      examMarks
        .filter((m) => m.examId === exam.id && m.subject === subject)
        .map((m) => `${m.studentId}:${m.marks ?? ""}`)
        .sort()
        .join("|"),
    [examMarks, exam.id, subject],
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const subjectId = useMemo(() => {
    if (subjectIdProp) return subjectIdProp;
    return getAcademicsState().subjects.find((s) => s.name === subject)?.id ?? "";
  }, [subject, subjectIdProp]);

  useEffect(() => {
    void loadExamMarks(exam.id);
  }, [exam.id]);

  useEffect(() => {
    if (!isTeacher) return;
    setRosterLoading(true);
    void apiExamRoster(exam.id)
      .then(setRoster)
      .catch((err) =>
        toast(err instanceof Error ? err.message : "Could not load students", "error"),
      )
      .finally(() => setRosterLoading(false));
  }, [exam.id, isTeacher]);

  useEffect(() => {
    if (students.length === 0) return;
    const marks = getExaminationsState().marks.filter(
      (m) => m.examId === exam.id && m.subject === subject,
    );
    const init: Record<string, string> = {};
    for (const st of students) {
      const m = marks.find((x) => x.studentId === st.id);
      init[st.id] = m?.marks != null ? String(m.marks) : "";
    }
    setValues(init);
  }, [students, exam.id, subject, serverMarksKey]);

  const editable = !["LOCKED", "PUBLISHED", "ARCHIVED"].includes(exam.status);

  function handleMarkChange(studentId: string, raw: string) {
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    if (raw !== "") {
      const num = Number(raw);
      if (!Number.isNaN(num) && num > exam.maxMarks) return;
    }
    setValues((v) => ({ ...v, [studentId]: raw }));
  }

  async function handleSave() {
    const entries = students.map((st) => ({
      studentId: st.id,
      marks: values[st.id] === "" ? null : Number(values[st.id]),
    }));
    setSaving(true);
    const res = await saveMarks(exam.id, subject, entries, enteredBy, role, {
      subjectId: subjectId || undefined,
      exam,
    });
    setSaving(false);
    if (!res.ok) toast(res.error ?? "Save failed", "error");
    else toast("Marks saved", "success");
  }

  async function handleDownload() {
    if (!subjectId) return toast("Subject not resolved yet.", "error");
    setBusy(true);
    try {
      const { blob, filename } = await apiDownloadMarksTemplate(exam.id, subjectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Download failed", "error");
    } finally {
      setBusy(false);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!subjectId) {
      toast("Subject not resolved yet.", "error");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        setBusy(true);
        try {
          const base64 = String(reader.result).split(",")[1] ?? "";
          const summary = await apiImportMarks(exam.id, subjectId, base64);
          toast(
            `Import: ${summary.imported} new, ${summary.updated} updated, ${summary.failed} failed`,
            summary.failed > 0 ? "error" : "success",
          );
          if (summary.errors.length > 0) console.warn(summary.errors);
          await loadExamMarks(exam.id);
        } catch (err) {
          toast(err instanceof Error ? err.message : "Import failed", "error");
        } finally {
          setBusy(false);
        }
      })();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  if (rosterLoading) {
    return (
      <div className="flex justify-center rounded-2xl border bg-card py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="font-semibold">{exam.name}</h3>
          <p className="text-sm text-muted-foreground">
            {exam.className} — Section {exam.section} · {subject} · Max {exam.maxMarks}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => void handleDownload()}
              disabled={busy || !subjectId}
            >
              <Download className="mr-2 h-4 w-4" />
              Excel Template
            </Button>
            <label
              className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-secondary aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              aria-disabled={busy || !subjectId}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Excel
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                disabled={busy || !subjectId}
                onChange={handleUpload}
              />
            </label>
            <Button className="h-9" onClick={handleSave} disabled={saving || busy}>
              {saving ? "Saving…" : "Save Marks"}
            </Button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Student ID</th>
              <th className="px-4 py-2.5 font-medium">Student Name</th>
              <th className="px-4 py-2.5 font-medium">Subject</th>
              <th className="px-4 py-2.5 font-medium">Marks</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st, i) => (
              <tr key={st.id} className="border-t">
                <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{st.code}</td>
                <td className="px-4 py-2.5 font-medium">{st.fullName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{subject}</td>
                <td className="px-4 py-2.5">
                  {editable ? (
                    <Input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      className="h-8 w-24 tabular-nums"
                      value={values[st.id] ?? ""}
                      onChange={(e) => handleMarkChange(st.id, e.target.value)}
                    />
                  ) : (
                    <span className="tabular-nums">{values[st.id] || "—"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
