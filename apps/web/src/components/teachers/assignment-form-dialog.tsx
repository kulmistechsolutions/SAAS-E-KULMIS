"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  activeAcademicYear,
  classNamesForYear,
  ensureAcademicsLoaded,
  sectionNamesForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { academicYearNames } from "@/lib/academics/year-select";
import {
  createBulkAssignments,
  updateAssignment,
  useTeachersState,
  type TeacherAssignment,
} from "@/lib/teachers/store";
import type { AssignmentSlotInput } from "@/lib/teachers/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  teacherId?: string;
  assignment?: TeacherAssignment | null;
  onSaved?: (message: string) => void;
}

type SlotDraft = {
  key: string;
  className: string;
  /** "" = all sections */
  section: string;
  subjects: string[];
};

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function newSlotKey(): string {
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function SubjectChips({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (!options.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No subjects in the catalog. Add them under Academics first.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(toggleValue(selected, opt))}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
              checked
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-secondary/60",
            )}
          >
            {checked ? <Check className="h-3 w-3 text-primary" /> : null}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function AssignmentFormDialog({
  open,
  onClose,
  teacherId,
  assignment,
  onSaved,
}: Props) {
  const { teachers } = useTeachersState();
  const academics = useAcademicsState();
  const years = useMemo(
    () => academicYearNames(academics),
    [academics.academicYears],
  );
  const subjects = useMemo(
    () => academics.subjects.map((s) => s.name).sort(),
    [academics.subjects],
  );
  const isEdit = !!assignment;

  const [teacher, setTeacher] = useState(teacherId ?? "");
  const [year, setYear] = useState("");

  // Edit (single row)
  const [klass, setKlass] = useState("");
  const [sectionMode, setSectionMode] = useState<"one" | "all">("one");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");

  // Create (multi-slot)
  const [slots, setSlots] = useState<SlotDraft[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const classList = useMemo(
    () => classNamesForYear(year),
    [year, academics.classes],
  );

  const editSectionList = useMemo(
    () => sectionNamesForClass(klass, year),
    [klass, year, academics.sections],
  );

  const previewCount = useMemo(() => {
    if (isEdit) return 1;
    const seen = new Set<string>();
    let n = 0;
    for (const slot of slots) {
      for (const sub of slot.subjects) {
        const key = `${slot.className}|${slot.section}|${sub}`;
        if (seen.has(key)) continue;
        seen.add(key);
        n++;
      }
    }
    return n;
  }, [isEdit, slots]);

  function makeDefaultSlot(yearName: string): SlotDraft {
    const classes = classNamesForYear(yearName);
    const firstClass = classes[0] ?? "";
    const secs = sectionNamesForClass(firstClass, yearName);
    return {
      key: newSlotKey(),
      className: firstClass,
      section: secs[0] ?? "",
      subjects: subjects[0] ? [subjects[0]] : [],
    };
  }

  useEffect(() => {
    if (!open) return;
    void ensureAcademicsLoaded();
    setError(null);
    setSaving(false);
    const defaultYear = activeAcademicYear() || years[0] || "";
    if (assignment) {
      setTeacher(assignment.teacherId);
      setYear(assignment.academicYear);
      setKlass(assignment.className);
      setSectionMode(assignment.section ? "one" : "all");
      setSection(assignment.section ?? "");
      setSubject(assignment.subject);
      setSlots([]);
    } else {
      setTeacher(teacherId ?? teachers[0]?.id ?? "");
      setYear(defaultYear);
      setSlots([makeDefaultSlot(defaultYear)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens / target changes
  }, [open, assignment?.id, teacherId]);

  function updateSlot(key: string, patch: Partial<SlotDraft>) {
    setSlots((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    );
  }

  function removeSlot(key: string) {
    setSlots((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
  }

  function addSlot() {
    setSlots((prev) => [...prev, makeDefaultSlot(year)]);
  }

  async function handleSubmit() {
    setError(null);
    if (!teacher) return setError("Select a teacher.");
    setSaving(true);
    try {
      if (isEdit && assignment) {
        const res = await updateAssignment(assignment.id, {
          academicYear: year,
          className: klass,
          section: sectionMode === "all" ? null : section,
          subject,
        });
        if (!res.ok) return setError(res.error ?? "Update failed.");
        onSaved?.("Assignment updated.");
        onClose();
        return;
      }

      const slotInputs: AssignmentSlotInput[] = slots.map((s) => ({
        className: s.className,
        section: s.section ? s.section : null,
        subjects: s.subjects,
      }));

      const res = await createBulkAssignments({
        teacherId: teacher,
        academicYear: year,
        slots: slotInputs,
      });
      if (!res.ok) {
        const err = res.error ?? "Could not create assignments.";
        if (/session|sign in|bearer|unauthorized|401/i.test(err)) {
          return setError(
            "Your session expired. Sign in again, then retry Assign Subjects.",
          );
        }
        return setError(err);
      }

      const created = res.createdCount ?? 0;
      const skipped = res.skippedCount ?? 0;
      let msg = `${created} assignment${created === 1 ? "" : "s"} created.`;
      if (skipped > 0) {
        msg += ` ${skipped} exact duplicate${skipped === 1 ? "" : "s"} skipped.`;
      }
      onSaved?.(msg);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      scrollable
      title={isEdit ? "Edit Assignment" : "Assign Subjects"}
      description={
        isEdit
          ? "Update this single assignment row."
          : "Add one row per class and section. Select multiple subjects on each row — e.g. Grade 7 / A / Math + Physics + Chemistry."
      }
      className="sm:max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              "Save"
            ) : previewCount > 0 ? (
              `Assign ${previewCount}`
            ) : (
              "Assign"
            )}
          </Button>
        </>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
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
            <Select
              value={year}
              onChange={(e) => {
                const nextYear = e.target.value;
                setYear(nextYear);
                if (isEdit) {
                  const classes = classNamesForYear(nextYear);
                  setKlass(classes[0] ?? "");
                  setSection(
                    sectionNamesForClass(classes[0] ?? "", nextYear)[0] ?? "",
                  );
                } else {
                  setSlots([makeDefaultSlot(nextYear)]);
                }
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {isEdit ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Class</Label>
              <Select
                value={klass}
                onChange={(e) => {
                  const nextClass = e.target.value;
                  setKlass(nextClass);
                  setSection(sectionNamesForClass(nextClass, year)[0] ?? "");
                }}
              >
                {classList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Section</Label>
              <Select
                value={sectionMode}
                onChange={(e) =>
                  setSectionMode(e.target.value as "one" | "all")
                }
              >
                <option value="one">One section</option>
                <option value="all">All sections</option>
              </Select>
            </div>
            {sectionMode === "one" && (
              <div>
                <Label>Section Name</Label>
                <Select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                >
                  {editSectionList.map((s) => (
                    <option key={s} value={s}>
                      Section {s}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <Label>Subject</Label>
              <Select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Teaching slots</Label>
              <Button type="button" variant="outline" onClick={addSlot}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add class / section
              </Button>
            </div>

            {slots.map((slot, index) => {
              const sectionOpts = sectionNamesForClass(slot.className, year);
              return (
                <div
                  key={slot.key}
                  className="rounded-xl border bg-secondary/15 p-3 sm:p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Slot {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeSlot(slot.key)}
                      disabled={slots.length <= 1}
                      className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label required>Class / Grade</Label>
                      <Select
                        value={slot.className}
                        onChange={(e) => {
                          const nextClass = e.target.value;
                          const secs = sectionNamesForClass(nextClass, year);
                          updateSlot(slot.key, {
                            className: nextClass,
                            section: secs.includes(slot.section)
                              ? slot.section
                              : secs[0] ?? "",
                          });
                        }}
                      >
                        {classList.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label required>Section</Label>
                      <Select
                        value={slot.section}
                        onChange={(e) =>
                          updateSlot(slot.key, { section: e.target.value })
                        }
                      >
                        <option value="">All sections</option>
                        {sectionOpts.map((s) => (
                          <option key={s} value={s}>
                            Section {s}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <Label required>Subjects</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() =>
                          updateSlot(slot.key, {
                            subjects:
                              slot.subjects.length === subjects.length
                                ? []
                                : [...subjects],
                          })
                        }
                      >
                        {slot.subjects.length === subjects.length
                          ? "Clear"
                          : "Select all"}
                      </button>
                    </div>
                    <SubjectChips
                      options={subjects}
                      selected={slot.subjects}
                      onChange={(next) =>
                        updateSlot(slot.key, { subjects: next })
                      }
                    />
                    {slot.subjects.length > 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {slot.className}
                        {slot.section
                          ? ` · Section ${slot.section}`
                          : " · All sections"}{" "}
                        → {slot.subjects.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {previewCount > 0 ? (
              <p className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                Will create{" "}
                <span className="font-medium text-foreground">
                  {previewCount}
                </span>{" "}
                independent row
                {previewCount === 1 ? "" : "s"} for{" "}
                <span className="font-medium text-foreground">
                  {teachers.find((t) => t.id === teacher)?.fullName ??
                    "this teacher"}
                </span>
                . Only exact duplicates (same class, section, and subject) are
                skipped.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Dialog>
  );
}
