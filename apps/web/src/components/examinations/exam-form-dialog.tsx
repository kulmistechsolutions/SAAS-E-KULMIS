"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import {
  classNamesForYear,
  ensureAcademicsLoaded,
  sectionNamesForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { useAcademicYearSelect } from "@/lib/academics/year-select";
import { TERMS } from "@/lib/examinations/format";
import { createExams } from "@/lib/examinations/store";
import type { ExamType } from "@/lib/examinations/types";
import { useExaminationsState } from "@/lib/examinations/store";
import { toast } from "@/lib/toast";

interface ExamFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExamFormDialog({ open, onClose, onSuccess }: ExamFormDialogProps) {
  const tr = useT();
  const { examGroups } = useExaminationsState();
  const academics = useAcademicsState();
  const { year: academicYear, setYear: setAcademicYear } = useAcademicYearSelect("exam-create-year");
  const classOptions = useMemo(
    () => classNamesForYear(academicYear),
    [academicYear, academics.classes],
  );
  const sectionOptions = useMemo(() => {
    const names = new Set<string>();
    for (const c of classOptions) {
      for (const s of sectionNamesForClass(c, academicYear)) names.add(s);
    }
    return [...names].sort();
  }, [classOptions, academicYear, academics.sections]);

  const [name, setName] = useState("");
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

  useEffect(() => {
    if (open) void ensureAcademicsLoaded();
  }, [open]);

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
    const res = await createExams({
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
      title={tr("examinationsExamFormDialog.createExamination")}
      description={tr("examinationsExamFormDialog.subjectsAreLoadedAutomaticallyFromTeacher")}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tr("examinationsExamFormDialog.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating…" : "Create Exam"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label required>{tr("examinationsExamFormDialog.examName")}</Label>
          <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label required>{tr("examinationsExamFormDialog.academicYear")}</Label>
          <AcademicYearSelect className="mt-1.5" value={academicYear} onChange={setAcademicYear} />
        </div>
        <div>
          <Label required>{tr("examinationsExamFormDialog.examType")}</Label>
          <Select className="mt-1.5" value={examType} onChange={(e) => setExamType(e.target.value as ExamType)}>
            <option value="TEACHER_ASSESSMENT">{tr("examinationsExamFormDialog.teacherAssessment")}</option>
            <option value="SCHOOL_IMPORT">{tr("examinationsExamFormDialog.schoolImport")}</option>
          </Select>
        </div>
        <div>
          <Label>{tr("examinationsExamFormDialog.examGroup")}</Label>
          <Select className="mt-1.5" value={examGroupId} onChange={(e) => setExamGroupId(e.target.value)}>
            <option value="">{tr("examinationsExamFormDialog.none")}</option>
            {examGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>{tr("examinationsExamFormDialog.term")}</Label>
          <Select className="mt-1.5" value={term} onChange={(e) => setTerm(e.target.value)}>
            {TERMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>{tr("examinationsExamFormDialog.maximumMarks")}</Label>
          <Input className="mt-1.5" type="number" min={1} value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
        </div>
        <div>
          <Label required>{tr("examinationsExamFormDialog.weight")}</Label>
          <Input className="mt-1.5" type="number" min={1} max={100} value={weightPercent} onChange={(e) => setWeightPercent(e.target.value)} />
        </div>
        <div>
          <Label required>{tr("examinationsExamFormDialog.startDate")}</Label>
          <Input className="mt-1.5" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label required>{tr("examinationsExamFormDialog.endDate")}</Label>
          <Input className="mt-1.5" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>{tr("examinationsExamFormDialog.classesLeaveEmptyForAllWith")}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {classOptions.map((c) => (
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
          <Label>{tr("examinationsExamFormDialog.sections")}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {sectionOptions.map((s) => (
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
                {tr("examinationsExamFormDialog.section")} {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
