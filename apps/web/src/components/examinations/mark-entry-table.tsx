"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  exportMarksTemplate,
  parseMarksCsv,
} from "@/lib/examinations/print";
import {
  getExam,
  importMarksCsv,
  marksForExamSubject,
  saveMarks,
} from "@/lib/examinations/store";
import type { Exam } from "@/lib/examinations/types";
import { getState as getStudentsState } from "@/lib/students/store";
import { toast } from "@/lib/toast";

interface MarkEntryTableProps {
  exam: Exam;
  subject: string;
  enteredBy?: string;
  role?: string;
}

export function MarkEntryTable({
  exam,
  subject,
  enteredBy = "Admin User",
  role = "ADMINISTRATOR",
}: MarkEntryTableProps) {
  const students = useMemo(
    () =>
      getStudentsState()
        .students.filter(
          (s) =>
            s.status === "ACTIVE" &&
            s.academicYear === exam.academicYear &&
            s.className === exam.className &&
            (s.section ?? "") === exam.section,
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [exam],
  );

  const existing = marksForExamSubject(exam.id, subject);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const st of students) {
      const m = existing.find((x) => x.studentId === st.id);
      init[st.id] = m?.marks != null ? String(m.marks) : "";
    }
    setValues(init);
  }, [students, existing, exam.id, subject]);

  const editable = !["LOCKED", "PUBLISHED", "ARCHIVED"].includes(exam.status);

  function handleSave() {
    const entries = students.map((st) => ({
      studentId: st.id,
      marks: values[st.id] === "" ? null : Number(values[st.id]),
    }));
    setSaving(true);
    const res = saveMarks(exam.id, subject, entries, enteredBy, role);
    setSaving(false);
    if (!res.ok) toast(res.error ?? "Save failed", "error");
    else toast("Marks saved", "success");
  }

  function handleDownload() {
    exportMarksTemplate(exam, subject, existing);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseMarksCsv(String(reader.result));
      const summary = importMarksCsv(exam.id, subject, rows, enteredBy, role);
      toast(
        `Import: ${summary.imported} new, ${summary.updated} updated, ${summary.failed} failed`,
        summary.failed > 0 ? "error" : "success",
      );
      if (summary.errors.length > 0) {
        console.warn(summary.errors);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
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
            <Button variant="outline" className="h-9" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-secondary">
              <Upload className="mr-2 h-4 w-4" />
              Import
              <input type="file" accept=".csv" className="hidden" onChange={handleUpload} />
            </label>
            <Button className="h-9" onClick={handleSave} disabled={saving}>
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
                      type="number"
                      min={0}
                      max={exam.maxMarks}
                      className="h-8 w-24"
                      value={values[st.id] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [st.id]: e.target.value }))
                      }
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
