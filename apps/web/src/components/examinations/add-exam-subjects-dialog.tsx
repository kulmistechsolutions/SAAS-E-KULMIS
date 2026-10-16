"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ensureAcademicsLoaded, useAcademicsState } from "@/lib/academics/store";
import { addExamSubjects } from "@/lib/examinations/store";
import type { Exam } from "@/lib/examinations/types";
import { toast } from "@/lib/toast";

/**
 * Add a subject that was left off an exam — without deleting the exam and
 * every mark already entered in it. Subjects this class is set up to study
 * are listed first; anything already on the exam is shown ticked and fixed.
 */
export function AddExamSubjectsDialog({
  exam,
  onClose,
}: {
  exam: Exam | null;
  onClose: () => void;
}) {
  const academics = useAcademicsState();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (exam) {
      setPicked(new Set());
      void ensureAcademicsLoaded();
    }
  }, [exam]);

  const { inClass, others, onExam } = useMemo(() => {
    if (!exam) return { inClass: [], others: [], onExam: new Set<string>() };
    const onExam = new Set(exam.subjects.map((n) => n.trim().toLowerCase()));
    const classSubjectIds = new Set(
      academics.classSubjects.filter((cs) => cs.classId === exam.classId).map((cs) => cs.subjectId),
    );
    const active = academics.subjects
      .filter((s) => s.status === "ACTIVE")
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      inClass: active.filter((s) => classSubjectIds.has(s.id)),
      others: active.filter((s) => !classSubjectIds.has(s.id)),
      onExam,
    };
  }, [exam, academics.subjects, academics.classSubjects]);

  function toggle(id: string) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function save() {
    if (!exam || picked.size === 0) return;
    setBusy(true);
    const res = await addExamSubjects(exam.id, [...picked]);
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Failed to add subjects", "error");
      return;
    }
    const added = res.added ?? [];
    const noTeacher = added.filter((a) => !a.hasTeacher).map((a) => a.name);
    toast(
      `Added ${added.map((a) => a.name).join(", ") || "nothing new"} to ${exam.name}.` +
        (noTeacher.length
          ? ` No teacher is assigned to ${noTeacher.join(", ")} for this class yet — assign one so they can enter marks.`
          : " Teachers can now enter marks for them."),
      noTeacher.length ? "info" : "success",
    );
    onClose();
  }

  const row = (s: { id: string; name: string }) => {
    const already = onExam.has(s.name.trim().toLowerCase());
    return (
      <label
        key={s.id}
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${already ? "opacity-60" : "cursor-pointer hover:bg-secondary"}`}
      >
        <input
          type="checkbox"
          disabled={already}
          checked={already || picked.has(s.id)}
          onChange={() => toggle(s.id)}
        />
        <span>{s.name}</span>
        {already && <span className="ms-auto text-[11px] text-muted-foreground">already on exam</span>}
      </label>
    );
  };

  return (
    <Dialog
      open={!!exam}
      onClose={onClose}
      title="Add subjects to this exam"
      description={
        exam
          ? `${exam.name} — ${exam.className}${exam.section && exam.section !== "All" ? ` ${exam.section}` : ""}. Subjects and marks already on the exam are kept.`
          : undefined
      }
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || picked.size === 0}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            Add {picked.size || ""} subject{picked.size === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {inClass.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Subjects of this class</p>
            {inClass.map(row)}
          </div>
        )}
        {others.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">
              {inClass.length > 0 ? "Other subjects" : "Subjects"}
            </p>
            {others.map(row)}
          </div>
        )}
        {inClass.length + others.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading subjects…</p>
        )}
      </div>
    </Dialog>
  );
}
