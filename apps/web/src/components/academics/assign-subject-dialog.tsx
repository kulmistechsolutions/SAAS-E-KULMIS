"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  assignSubjectToClass,
  getAcademicsState,
  subjectsForClass,
} from "@/lib/academics/store";

interface Props {
  open: boolean;
  onClose: () => void;
  classId: string;
}

export function AssignSubjectDialog({ open, onClose, classId }: Props) {
  const state = getAcademicsState();
  const assignedIds = new Set(subjectsForClass(classId).map((s) => s.id));
  const available = state.subjects.filter(
    (s) => s.status === "ACTIVE" && !assignedIds.has(s.id),
  );
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubjectId(available[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId]);

  function submit() {
    setError(null);
    if (!subjectId) return setError("Please select a subject.");
    const res = assignSubjectToClass(classId, subjectId);
    if (!res.ok) return setError(res.error ?? "Operation failed.");
    toast("Subject assigned to class.", "success");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Assign Subject"
      description="Assign a subject to this class."
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={available.length === 0}>
            Assign
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          All active subjects are already assigned to this class.
        </p>
      ) : (
        <div>
          <Label required>Subject</Label>
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.code ? ` (${s.code})` : ""}
              </option>
            ))}
          </Select>
        </div>
      )}
    </Dialog>
  );
}
