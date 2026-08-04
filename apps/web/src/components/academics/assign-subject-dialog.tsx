"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  assignSubjectToClass,
  getAcademicsState,
  getClass,
  sectionsForClass,
  subjectsForClass,
} from "@/lib/academics/store";
import { createAssignment, useTeachersState } from "@/lib/teachers/store";

interface Props {
  open: boolean;
  onClose: () => void;
  classId: string;
}

/** Sentinel for "every section" in the teacher select — a real section id is never this string. */
const ALL_SECTIONS = "__all__";

export function AssignSubjectDialog({ open, onClose, classId }: Props) {
  const t = useT();
  const state = getAcademicsState();
  const { teachers } = useTeachersState();
  const cls = getClass(classId);
  const sections = useMemo(() => sectionsForClass(classId), [classId, state]);
  const assignedIds = new Set(subjectsForClass(classId).map((s) => s.id));
  const available = state.subjects.filter(
    (s) => s.status === "ACTIVE" && !assignedIds.has(s.id),
  );
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [sectionId, setSectionId] = useState(ALL_SECTIONS);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubjectId(available[0]?.id ?? "");
    setTeacherId("");
    setSectionId(ALL_SECTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId]);

  async function submit() {
    setError(null);
    if (!subjectId) return setError("Please select a subject.");
    if (!cls) return setError("Class not found.");
    const subject = state.subjects.find((s) => s.id === subjectId);
    if (!subject) return setError("Subject not found.");

    setSaving(true);
    const res = await assignSubjectToClass(classId, subjectId);
    if (!res.ok) {
      setSaving(false);
      return setError(res.error ?? "Operation failed.");
    }

    // Assigning a teacher alongside the subject is optional — a school can
    // attach the subject now and pick who teaches it later from Teacher
    // Assignments, same as it always could.
    if (teacherId) {
      const section = sections.find((s) => s.id === sectionId);
      const assignRes = await createAssignment({
        teacherId,
        academicYear: cls.academicYear,
        className: cls.name,
        section: sectionId === ALL_SECTIONS ? null : (section?.name ?? null),
        subject: subject.name,
      });
      if (!assignRes.ok) {
        setSaving(false);
        toast(
          `${subject.name} was assigned to the class, but the teacher assignment failed: ${assignRes.error ?? "Unknown error"}`,
          "error",
        );
        onClose();
        return;
      }
    }

    setSaving(false);
    toast(
      teacherId
        ? `${subject.name} assigned to ${cls.name}, with a teacher.`
        : "Subject assigned to class.",
      "success",
    );
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("academicsAssignSubjectDialog.assignSubject")}
      description={t("academicsAssignSubjectDialog.assignASubjectToThisClass")}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("academicsAssignSubjectDialog.cancel")}
          </Button>
          <Button onClick={submit} disabled={available.length === 0 || saving}>
            {saving ? "…" : t("academicsAssignSubjectDialog.assign")}
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
          {t("academicsAssignSubjectDialog.allActiveSubjectsAreAlreadyAssigned")}
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <Label required>{t("academicsAssignSubjectDialog.subject")}</Label>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.code ? ` (${s.code})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("academicsAssignSubjectDialog.teacherOptional")}</Label>
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">
                {t("academicsAssignSubjectDialog.assignLater")}
              </option>
              {teachers.map((tch) => (
                <option key={tch.id} value={tch.id}>
                  {tch.fullName} ({tch.code})
                </option>
              ))}
            </Select>
          </div>
          {teacherId && sections.length > 0 && (
            <div>
              <Label>{t("academicsAssignSubjectDialog.section")}</Label>
              <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value={ALL_SECTIONS}>
                  {t("academicsAssignSubjectDialog.allSections")}
                </option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t("academicsClasses.section")} {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
