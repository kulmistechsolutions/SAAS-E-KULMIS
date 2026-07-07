"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { createSubject, updateSubject } from "@/lib/academics/store";
import type { EntityStatus, Subject } from "@/lib/academics/types";

interface Props {
  open: boolean;
  onClose: () => void;
  subject?: Subject | null;
}

export function SubjectFormDialog({ open, onClose, subject }: Props) {
  const isEdit = !!subject;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<EntityStatus>("ACTIVE");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (subject) {
      setName(subject.name);
      setCode(subject.code ?? "");
      setStatus(subject.status);
    } else {
      setName("");
      setCode("");
      setStatus("ACTIVE");
    }
  }, [open, subject]);

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Subject name is required.");
    const res =
      isEdit && subject
        ? updateSubject(subject.id, { name, code, status })
        : createSubject({ name, code, status });
    if (!res.ok) return setError(res.error ?? "Operation failed.");
    toast(isEdit ? "Subject updated." : "Subject created.", "success");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Subject" : "Add Subject"}
      description="Subject names must be unique across the school."
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{isEdit ? "Save Changes" : "Create Subject"}</Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
      <div className="grid gap-4">
        <div>
          <Label required>Subject Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mathematics"
          />
        </div>
        <div>
          <Label>Subject Code</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. MAT"
          />
        </div>
        <div>
          <Label required>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as EntityStatus)}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
      </div>
    </Dialog>
  );
}
