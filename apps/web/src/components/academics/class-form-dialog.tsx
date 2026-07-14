"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import {
  activeAcademicYear,
  canCreateClassInYear,
  createClass,
  getAcademicsState,
  updateClass,
} from "@/lib/academics/store";
import type { EntityStatus, SchoolClass } from "@/lib/academics/types";

interface Props {
  open: boolean;
  onClose: () => void;
  cls?: SchoolClass | null;
}

export function ClassFormDialog({ open, onClose, cls }: Props) {
  const isEdit = !!cls;
  const years = getAcademicsState().academicYears;
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState<string>(activeAcademicYear());
  const [hasSections, setHasSections] = useState(true);
  const [status, setStatus] = useState<EntityStatus>("ACTIVE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const allowCreate = canCreateClassInYear(academicYear);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (cls) {
      setName(cls.name);
      setAcademicYear(cls.academicYear);
      setHasSections(cls.hasSections);
      setStatus(cls.status);
      setNotes(cls.notes ?? "");
    } else {
      setName("");
      setAcademicYear(activeAcademicYear());
      setHasSections(true);
      setStatus("ACTIVE");
      setNotes("");
    }
  }, [open, cls]);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Class name is required.");
    if (!isEdit && !allowCreate) {
      return setError(
        "This academic year already has 12 classes. Rename an existing class instead.",
      );
    }
    const input = {
      name,
      academicYear,
      hasSections,
      status,
      notes: notes || null,
    };
    const res =
      isEdit && cls ? await updateClass(cls.id, input) : await createClass(input);
    if (!res.ok) return setError(res.error ?? "Operation failed.");
    toast(isEdit ? "Class renamed." : "Class created.", "success");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Rename Class" : "Add Class"}
      description={
        isEdit
          ? "Update the display name for this grade. The class record stays the same — no duplicate is created."
          : "Class names must be unique within an academic year. Each year supports up to 12 grades."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!isEdit && !allowCreate}>
            {isEdit ? "Save Name" : "Create Class"}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label required>Class Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grade 7"
          />
        </div>
        <div>
          <Label required>Academic Year</Label>
          <Select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            disabled={isEdit}
          >
            {years.map((y) => (
              <option key={y.id} value={y.name}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>Has Sections</Label>
          <Select
            value={hasSections ? "yes" : "no"}
            onChange={(e) => setHasSections(e.target.value === "yes")}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
        </div>
        <div>
          <Label required>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as EntityStatus)}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}
