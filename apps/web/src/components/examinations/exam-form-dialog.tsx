"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TERMS } from "@/lib/examinations/format";
import { createExams } from "@/lib/examinations/store";
import type { ExamType } from "@/lib/examinations/types";
import { ACADEMIC_YEARS, CLASSES, SECTIONS } from "@/lib/students/constants";
import { useExaminationsState } from "@/lib/examinations/store";
import { toast } from "@/lib/toast";

interface ExamFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExamFormDialog({ open, onClose, onSuccess }: ExamFormDialogProps) {
  const { examGroups } = useExaminationsState();
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState<string>(ACADEMIC_YEARS[0]);
  const [examType, setExamType] = useState<ExamType>("TEACHER_ASSESSMENT");
  const [examGroupId, setExamGroupId] = useState("");
  const [term, setTerm] = useState<string>(TERMS[0]);
  const [maxMarks, setMaxMarks] = useState("50");
  const [weightPercent, setWeightPercent] = useState("30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleClass(c: string) {
    setSelectedClasses((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function toggleSection(s: string) {
    setSelectedSections((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast("Exam name is required", "error");
      return;
    }
    if (!startDate || !endDate) {
      toast("Start and end dates are required", "error");
      return;
    }
    setSubmitting(true);
    const res = createExams({
      name: name.trim(),
      academicYear,
      examType,
      examGroupId: examGroupId || null,
      term,
      maxMarks: Number(maxMarks) || 50,
      weightPercent: Number(weightPercent) || 100,
      startDate,
      endDate,
      classNames: selectedClasses,
      sections: selectedSections,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast(res.error ?? "Failed to create exam", "error");
      return;
    }
    toast(`Created ${res.exams?.length ?? 0} exam instance(s)`, "success");
    onSuccess?.();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Examination"
      description="Subjects are loaded automatically from teacher assignments."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating…" : "Create Exam"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label required>Exam Name</Label>
          <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label required>Academic Year</Label>
          <Select className="mt-1.5" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            {ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>Exam Type</Label>
          <Select className="mt-1.5" value={examType} onChange={(e) => setExamType(e.target.value as ExamType)}>
            <option value="TEACHER_ASSESSMENT">Teacher Assessment</option>
            <option value="SCHOOL_IMPORT">School Import</option>
          </Select>
        </div>
        <div>
          <Label>Exam Group</Label>
          <Select className="mt-1.5" value={examGroupId} onChange={(e) => setExamGroupId(e.target.value)}>
            <option value="">None</option>
            {examGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>Term</Label>
          <Select className="mt-1.5" value={term} onChange={(e) => setTerm(e.target.value)}>
            {TERMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>Maximum Marks</Label>
          <Input className="mt-1.5" type="number" min={1} value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
        </div>
        <div>
          <Label required>Weight %</Label>
          <Input className="mt-1.5" type="number" min={1} max={100} value={weightPercent} onChange={(e) => setWeightPercent(e.target.value)} />
        </div>
        <div>
          <Label required>Start Date</Label>
          <Input className="mt-1.5" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label required>End Date</Label>
          <Input className="mt-1.5" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Classes (leave empty for all with sections)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CLASSES.slice(0, 8).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleClass(c)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedClasses.includes(c)
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-secondary"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label>Sections</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSection(s)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedSections.includes(s)
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-secondary"
                }`}
              >
                Section {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
