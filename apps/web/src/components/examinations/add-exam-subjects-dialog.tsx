"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ensureAcademicsLoaded, useAcademicsState } from "@/lib/academics/store";
import { addExamSubjects, removeExamSubject } from "@/lib/examinations/store";
import { apiExamSubjectSummary, type ApiExamSubjectSummary } from "@/lib/examinations/api";
import type { Exam } from "@/lib/examinations/types";
import { toast } from "@/lib/toast";

/**
 * The subjects of an exam: take one off (its marks go with it and the students
 * are no longer calculated for it), or add one that was left off — either way
 * without deleting the exam and every other mark entered in it.
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
  const [summary, setSummary] = useState<ApiExamSubjectSummary[] | null>(null);
  /** The subject whose removal is waiting for a second click. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadSummary = useCallback(async (id: string) => {
    try {
      setSummary(await apiExamSubjectSummary(id));
    } catch {
      setSummary([]);
    }
  }, []);

  useEffect(() => {
    if (exam) {
      setPicked(new Set());
      setConfirming(null);
      setSummary(null);
      void ensureAcademicsLoaded();
      void loadSummary(exam.id);
    }
  }, [exam, loadSummary]);

  async function remove(subjectId: string) {
    if (!exam) return;
    setRemoving(subjectId);
    const res = await removeExamSubject(exam.id, subjectId);
    setRemoving(null);
    setConfirming(null);
    if (!res.ok) {
      toast(res.error ?? "Failed to remove the subject", "error");
      return;
    }
    toast(
      `${res.name ?? "Subject"} removed from ${exam.name}` +
        (res.marksRemoved ? ` — ${res.marksRemoved} mark${res.marksRemoved === 1 ? "" : "s"} removed with it.` : "."),
      "success",
    );
    await loadSummary(exam.id);
  }

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
      title="Exam subjects"
      description={
        exam
          ? `${exam.name} — ${exam.className}${exam.section && exam.section !== "All" ? ` ${exam.section}` : ""}. Take a subject off, or add one that was left out. Everything else on the exam is kept.`
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
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">On this exam</p>
          {summary === null ? (
            <p className="py-2 text-xs text-muted-foreground">Loading…</p>
          ) : (
            summary.map((s) => (
              <div key={s.subjectId} className="rounded-lg px-2 py-1.5 text-sm hover:bg-secondary/60">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {s.marksEntered > 0 ? `${s.marksEntered} marks entered` : "no marks yet"}
                  </span>
                  {summary.length > 1 && confirming !== s.subjectId && (
                    <button
                      type="button"
                      onClick={() => setConfirming(s.subjectId)}
                      className="ms-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>
                {confirming === s.subjectId && (
                  <div className="mt-1.5 rounded-lg border border-rose-300/60 bg-rose-50/60 p-2 text-xs dark:border-rose-900/50 dark:bg-rose-950/20">
                    <p>
                      Remove <b>{s.name}</b> from this exam?{" "}
                      {s.marksEntered > 0
                        ? `The ${s.marksEntered} marks entered for it will be removed too, and students will no longer be calculated for it. `
                        : "Students will no longer be calculated for it. "}
                      Other subjects are not affected.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => setConfirming(null)}>
                        Keep it
                      </Button>
                      <Button
                        className="h-7 bg-rose-600 px-2 text-xs hover:bg-rose-700"
                        disabled={removing === s.subjectId}
                        onClick={() => void remove(s.subjectId)}
                      >
                        {removing === s.subjectId && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
                        Yes, remove
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          {summary !== null && summary.length === 1 && (
            <p className="px-2 pt-1 text-[11px] text-muted-foreground">
              An exam needs at least one subject, so the last one cannot be removed.
            </p>
          )}
        </div>
        <p className="border-t pt-3 text-xs font-semibold text-muted-foreground">Add a subject</p>
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
