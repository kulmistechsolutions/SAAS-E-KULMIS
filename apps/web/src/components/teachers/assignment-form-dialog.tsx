"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ACADEMIC_YEARS,
  ACTIVE_ACADEMIC_YEAR,
  CLASSES,
  SECTIONS,
  SUBJECTS,
} from "@/lib/teachers/constants";
import {
  createAssignment,
  updateAssignment,
  useTeachersState,
  type TeacherAssignment,
} from "@/lib/teachers/store";

interface Props {
  open: boolean;
  onClose: () => void;
  teacherId?: string;
  assignment?: TeacherAssignment | null;
  onSaved?: (message: string) => void;
}

export function AssignmentFormDialog({
  open,
  onClose,
  teacherId,
  assignment,
  onSaved,
}: Props) {
  const { teachers } = useTeachersState();
  const isEdit = !!assignment;

  const [teacher, setTeacher] = useState(teacherId ?? "");
  const [year, setYear] = useState<string>(ACTIVE_ACADEMIC_YEAR);
  const [klass, setKlass] = useState<string>(CLASSES[0]);
  const [sectionMode, setSectionMode] = useState<"one" | "all">("one");
  const [section, setSection] = useState<string>(SECTIONS[0]);
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (assignment) {
      setTeacher(assignment.teacherId);
      setYear(assignment.academicYear);
      setKlass(assignment.className);
      setSectionMode(assignment.section ? "one" : "all");
      setSection(assignment.section ?? SECTIONS[0]);
      setSubject(assignment.subject);
    } else {
      setTeacher(teacherId ?? teachers[0]?.id ?? "");
      setYear(ACTIVE_ACADEMIC_YEAR);
      setKlass(CLASSES[0]);
      setSectionMode("one");
      setSection(SECTIONS[0]);
      setSubject(SUBJECTS[0]);
    }
  }, [open, assignment, teacherId, teachers]);

  function handleSubmit() {
    setError(null);
    if (!teacher) return setError("Select a teacher.");

    const payload = {
      teacherId: teacher,
      academicYear: year,
      className: klass,
      section: sectionMode === "all" ? null : section,
      subject,
    };

    if (isEdit && assignment) {
      const res = updateAssignment(assignment.id, payload);
      if (!res.ok) return setError(res.error ?? "Update failed.");
      onSaved?.("Assignment updated.");
      onClose();
      return;
    }

    const res = createAssignment(payload);
    if (!res.ok) return setError(res.error ?? "Could not create assignment.");
    onSaved?.("Assignment created.");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Assignment" : "Assign Subject"}
      description="Assign a teacher to a class, section, and subject for an academic year."
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{isEdit ? "Save" : "Assign"}</Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600">
          {error}
        </div>
      )}
      <div className="grid gap-4">
        <div>
          <Label required>Teacher</Label>
          <Select
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            disabled={!!teacherId && !isEdit}
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName} ({t.code})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Academic Year</Label>
          <Select value={year} onChange={(e) => setYear(e.target.value)}>
            {ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Class</Label>
          <Select value={klass} onChange={(e) => setKlass(e.target.value)}>
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Section</Label>
          <Select value={sectionMode} onChange={(e) => setSectionMode(e.target.value as "one" | "all")}>
            <option value="one">Specific Section</option>
            <option value="all">All Sections</option>
          </Select>
          {sectionMode === "one" && (
            <Select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="mt-2"
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>Section {s}</option>
              ))}
            </Select>
          )}
        </div>
        <div>
          <Label>Subject</Label>
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
      </div>
    </Dialog>
  );
}
