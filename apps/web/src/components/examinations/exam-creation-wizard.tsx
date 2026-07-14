"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import {
  apiListClasses,
  apiListSections,
  type ApiClass,
  type ApiSection,
} from "@/lib/academics/api";
import {
  ensureAcademicsLoaded,
  getAcademicsState,
  useAcademicsState,
} from "@/lib/academics/store";
import { useAcademicYearSelect } from "@/lib/academics/year-select";
import {
  apiCreateExamsBulk,
  apiListExamGroups,
  apiPreviewExamCreation,
  type ExamCreationBulkBody,
  type ExamCreationPreview,
  type ExamCreationTarget,
} from "@/lib/examinations/api";
import { ApiError } from "@/lib/api";
import {
  EXAM_CATEGORIES,
  examTypeLabel,
  TERMS,
} from "@/lib/examinations/format";
import type { ExamType } from "@/lib/examinations/types";
import { refreshExaminations } from "@/lib/examinations/store";
import { loadTeacherMe } from "@/lib/teachers/session";
import type { TeacherMe } from "@/lib/teachers/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "info", label: "Exam Info", icon: BookOpen },
  { id: "classes", label: "Classes", icon: GraduationCap },
  { id: "sections", label: "Sections", icon: Layers },
  { id: "preview", label: "Preview", icon: ClipboardList },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface ExamCreationWizardProps {
  /** Admin creates for whole school; teacher only for assigned classes. */
  mode?: "admin" | "teacher";
  /** Redirect after successful creation. */
  successHref?: string;
}

export function ExamCreationWizard({
  mode = "admin",
  successHref,
}: ExamCreationWizardProps) {
  const router = useRouter();
  const isTeacher = mode === "teacher";
  const academics = useAcademicsState();
  const { year: academicYear, setYear: setAcademicYear } =
    useAcademicYearSelect("exam-wizard-year");

  const yearId = useMemo(
    () =>
      academics.academicYears.find((y) => y.name === academicYear)?.id ?? "",
    [academics.academicYears, academicYear],
  );
  const [teacherMe, setTeacherMe] = useState<TeacherMe | null>(null);
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [sections, setSections] = useState<ApiSection[]>([]);
  const [examGroups, setExamGroups] = useState<
    { id: string; name: string }[]
  >([]);
  const [loadingData, setLoadingData] = useState(true);
  const [classesLoadedForYear, setClassesLoadedForYear] = useState("");

  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [examType, setExamType] = useState<ExamType>("TEACHER_ASSESSMENT");
  const [term, setTerm] = useState<string>(TERMS[0]);
  const [examGroupId, setExamGroupId] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [weightPercent, setWeightPercent] = useState("100");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [allClasses, setAllClasses] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  /** Per-class section picks: classId -> section ids (empty = all sections) */
  const [sectionPicks, setSectionPicks] = useState<Record<string, string[]>>({});
  const [sectionModeAll, setSectionModeAll] = useState<Record<string, boolean>>(
    {},
  );

  const [preview, setPreview] = useState<ExamCreationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState<StepId>("info");

  const classOptions = useMemo(() => {
    if (!isTeacher || !teacherMe) return classes;
    const assigned = new Set(
      teacherMe.assignments
        .filter((a) => a.academicYearId === yearId || !yearId)
        .map((a) => a.classId),
    );
    return classes.filter((c) => assigned.has(c.id));
  }, [classes, isTeacher, teacherMe, yearId]);

  const sectionsByClass = useMemo(() => {
    const m = new Map<string, ApiSection[]>();
    for (const s of sections) {
      const list = m.get(s.classId) ?? [];
      list.push(s);
      m.set(s.classId, list);
    }
    return m;
  }, [sections]);

  useEffect(() => {
    void ensureAcademicsLoaded();
  }, []);

  useEffect(() => {
    void (async () => {
      setLoadingData(true);
      try {
        await ensureAcademicsLoaded();
        const resolvedYearId =
          getAcademicsState().academicYears.find((y) => y.name === academicYear)
            ?.id ?? "";
        if (!resolvedYearId) return;

        if (isTeacher) {
          const me = await loadTeacherMe();
          setTeacherMe(me);
        }
        const [cls, sec] = await Promise.all([
          apiListClasses(resolvedYearId),
          apiListSections(),
        ]);
        setClasses(cls.filter((c) => c.status === "ACTIVE"));
        setSections(sec.filter((s) => s.status === "ACTIVE"));
        const groups = await apiListExamGroups(resolvedYearId);
        setExamGroups(groups.map((g) => ({ id: g.id, name: g.name })));
        setClassesLoadedForYear(resolvedYearId);
      } catch {
        toast("Could not load academic data", "error");
      } finally {
        setLoadingData(false);
      }
    })();
  }, [academicYear, isTeacher]);

  useEffect(() => {
    if (category && !name) setName(category);
  }, [category, name]);

  const selectedClasses = useMemo(
    () =>
      allClasses
        ? classOptions
        : classOptions.filter((c) => selectedClassIds.includes(c.id)),
    [allClasses, classOptions, selectedClassIds],
  );

  const buildTargets = useCallback((): ExamCreationTarget[] => {
    const targets: ExamCreationTarget[] = [];
    for (const cls of selectedClasses) {
      const classSections = sectionsByClass.get(cls.id) ?? [];
      if (!cls.hasSections || classSections.length === 0) {
        targets.push({ classId: cls.id, sectionId: null });
        continue;
      }
      const useAll = sectionModeAll[cls.id] ?? true;
      const picked = sectionPicks[cls.id] ?? [];
      const sectionIds = useAll
        ? classSections.map((s) => s.id)
        : picked.length > 0
          ? picked
          : classSections.map((s) => s.id);
      for (const sid of sectionIds) {
        targets.push({ classId: cls.id, sectionId: sid });
      }
    }
    return targets;
  }, [selectedClasses, sectionsByClass, sectionModeAll, sectionPicks]);

  const bulkBody = useMemo((): ExamCreationBulkBody | null => {
    if (!yearId || !name.trim()) return null;
    const targets = buildTargets();
    if (targets.length === 0) return null;
    return {
      name: name.trim(),
      academicYearId: yearId,
      examGroupId: examGroupId || null,
      examType,
      term,
      maxMarks: Number(maxMarks) || 100,
      weightPercent: Number(weightPercent) || 100,
      startDate,
      endDate,
      targets,
    };
  }, [
    yearId,
    name,
    examGroupId,
    examType,
    term,
    maxMarks,
    weightPercent,
    startDate,
    endDate,
    buildTargets,
  ]);

  function toggleClass(id: string) {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSection(classId: string, sectionId: string) {
    setSectionPicks((prev) => {
      const cur = prev[classId] ?? [];
      const next = cur.includes(sectionId)
        ? cur.filter((x) => x !== sectionId)
        : [...cur, sectionId];
      return { ...prev, [classId]: next };
    });
  }

  function validateInfo(): string | null {
    if (!academicYear) return "Select an academic year.";
    if (!yearId) return "Academic year is still loading. Please wait a moment.";
    if (!name.trim()) return "Enter an exam name.";
    if (!startDate || !endDate) return "Start and end dates are required.";
    if (endDate < startDate) return "End date must be on or after start date.";
    const mm = Number(maxMarks);
    const wp = Number(weightPercent);
    if (!mm || mm <= 0) return "Maximum marks must be greater than zero.";
    if (!wp || wp < 1 || wp > 100) return "Weight must be between 1 and 100.";
    return null;
  }

  function validateClasses(): string | null {
    if (selectedClasses.length === 0) {
      return allClasses
        ? "No active classes found for this academic year."
        : "Select at least one class or choose All Classes.";
    }
    return null;
  }

  function previewErrorMessage(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return "Preview failed";
  }

  async function loadPreview(): Promise<boolean> {
    if (!bulkBody) {
      toast(
        "Could not build preview. Check academic year, dates, and class selections.",
        "error",
      );
      return false;
    }
    setPreviewLoading(true);
    try {
      const res = await apiPreviewExamCreation(bulkBody);
      setPreview(res);
      return true;
    } catch (e) {
      setPreview(null);
      toast(previewErrorMessage(e), "error");
      return false;
    } finally {
      setPreviewLoading(false);
    }
  }

  async function goNext() {
    if (step === "info") {
      const err = validateInfo();
      if (err) return toast(err, "error");
      setStep("classes");
      return;
    }
    if (step === "classes") {
      const err = validateClasses();
      if (err) return toast(err, "error");
      setStep("sections");
      return;
    }
    if (step === "sections") {
      const ok = await loadPreview();
      if (ok) setStep("preview");
      return;
    }
  }

  function goBack() {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx > 0) setStep(STEPS[idx - 1]!.id);
  }

  async function handleCreate() {
    if (!bulkBody || !preview?.canCreate) return;
    setSubmitting(true);
    try {
      const res = await apiCreateExamsBulk(bulkBody);
      await refreshExaminations();
      toast(`Created ${res.count} examination(s) in Draft status`, "success");
      const href =
        successHref ?? (isTeacher ? "/teacher-portal/exams" : "/examinations");
      router.push(href);
    } catch (e) {
      toast(previewErrorMessage(e), "error");
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const waitingForYear = !!academicYear && !yearId;
  const waitingForClasses = !!yearId && classesLoadedForYear !== yearId;

  if (loadingData || waitingForYear || waitingForClasses) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        Loading wizard…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Step indicator */}
      <nav className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = s.id === step;
          const done = i < stepIndex;
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                active && "border-primary bg-primary/10 text-primary font-medium",
                done && !active && "border-emerald-500/40 bg-emerald-500/5 text-emerald-700",
                !active && !done && "text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {s.label}
            </div>
          );
        })}
      </nav>

      <div className="animate-fade-up rounded-2xl border bg-card p-6 shadow-sm">
        {step === "info" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Exam information</h2>
              <p className="text-sm text-muted-foreground">
                Subjects load automatically from teacher assignments — you never
                pick them manually.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label required>Academic Year</Label>
                <AcademicYearSelect
                  className="mt-1.5"
                  value={academicYear}
                  onChange={setAcademicYear}
                />
              </div>
              <div>
                <Label>Category (optional)</Label>
                <Select
                  className="mt-1.5"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Custom name…</option>
                  {EXAM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label required>Exam Name</Label>
                <Input
                  className="mt-1.5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mid Term Examination"
                />
              </div>
              <div>
                <Label required>Exam Type</Label>
                <Select
                  className="mt-1.5"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as ExamType)}
                >
                  <option value="TEACHER_ASSESSMENT">
                    {examTypeLabel("TEACHER_ASSESSMENT")}
                  </option>
                  <option value="SCHOOL_IMPORT">
                    {examTypeLabel("SCHOOL_IMPORT")}
                  </option>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {examType === "SCHOOL_IMPORT"
                    ? "School uploads marks via Excel template."
                    : "Teachers enter marks manually or via Excel."}
                </p>
              </div>
              <div>
                <Label required>Term</Label>
                <Select
                  className="mt-1.5"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                >
                  {TERMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Exam Group (optional)</Label>
                <Select
                  className="mt-1.5"
                  value={examGroupId}
                  onChange={(e) => setExamGroupId(e.target.value)}
                >
                  <option value="">None</option>
                  {examGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label required>Maximum Marks</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min={1}
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(e.target.value)}
                />
              </div>
              <div>
                <Label required>Weight %</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min={1}
                  max={100}
                  value={weightPercent}
                  onChange={(e) => setWeightPercent(e.target.value)}
                />
              </div>
              <div>
                <Label required>Start Date</Label>
                <Input
                  className="mt-1.5"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label required>End Date</Label>
                <Input
                  className="mt-1.5"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {step === "classes" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Class selection</h2>
              <p className="text-sm text-muted-foreground">
                Choose all classes or select specific grades.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-muted/30 p-4">
              <input
                type="checkbox"
                checked={allClasses}
                onChange={(e) => {
                  setAllClasses(e.target.checked);
                  if (e.target.checked) setSelectedClassIds([]);
                }}
                className="h-4 w-4 rounded"
              />
              <div>
                <p className="font-medium">All Classes</p>
                <p className="text-xs text-muted-foreground">
                  Every active class in {academicYear} participates
                </p>
              </div>
            </label>
            {!allClasses && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {classOptions.map((c) => {
                  const on = selectedClassIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClass(c.id)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5",
                        on
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.hasSections ? "Has sections" : "No sections"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
            {classOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No classes available for this year.
              </p>
            )}
          </div>
        )}

        {step === "sections" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Section selection</h2>
              <p className="text-sm text-muted-foreground">
                For each class with sections, choose all or specific sections.
                Classes without sections are included automatically.
              </p>
            </div>
            {selectedClasses.map((cls) => {
              const classSections = sectionsByClass.get(cls.id) ?? [];
              if (!cls.hasSections || classSections.length === 0) {
                return (
                  <div
                    key={cls.id}
                    className="rounded-xl border bg-muted/20 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{cls.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — no sections (one exam for whole class)
                    </span>
                  </div>
                );
              }
              const allSec = sectionModeAll[cls.id] ?? true;
              return (
                <div key={cls.id} className="rounded-xl border p-4">
                  <p className="mb-3 font-semibold">{cls.name}</p>
                  <label className="mb-3 flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={allSec}
                      onChange={() =>
                        setSectionModeAll((p) => ({ ...p, [cls.id]: true }))
                      }
                    />
                    All sections
                  </label>
                  <label className="mb-3 flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={!allSec}
                      onChange={() =>
                        setSectionModeAll((p) => ({ ...p, [cls.id]: false }))
                      }
                    />
                    Specific sections
                  </label>
                  {!allSec && (
                    <div className="flex flex-wrap gap-2">
                      {classSections.map((s) => {
                        const on = (sectionPicks[cls.id] ?? []).includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSection(cls.id, s.id)}
                            className={cn(
                              "rounded-lg border px-3 py-1.5 text-sm",
                              on
                                ? "border-primary bg-primary/10 text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            Section {s.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Preview & confirm</h2>
            </div>
            {previewLoading ? (
              <p className="text-muted-foreground">Building preview…</p>
            ) : preview ? (
              <>
                <div className="grid gap-3 rounded-xl bg-muted/30 p-4 text-sm sm:grid-cols-2">
                  <PreviewRow label="Academic Year" value={preview.academicYear} />
                  <PreviewRow label="Exam Name" value={preview.name} />
                  <PreviewRow
                    label="Exam Type"
                    value={examTypeLabel(preview.examType)}
                  />
                  <PreviewRow label="Term" value={preview.term} />
                  <PreviewRow label="Maximum Marks" value={String(preview.maxMarks)} />
                  <PreviewRow
                    label="Weight"
                    value={`${preview.weightPercent}%`}
                  />
                  <PreviewRow label="Start" value={preview.startDate} />
                  <PreviewRow label="End" value={preview.endDate} />
                  <PreviewRow
                    label="Exams to create"
                    value={String(preview.creatableCount)}
                  />
                  <PreviewRow
                    label="Est. students"
                    value={String(preview.totalStudents)}
                  />
                  <PreviewRow
                    label="Assigned subjects"
                    value={String(preview.subjectCount)}
                  />
                </div>
                <div className="space-y-3">
                  {preview.instances.map((inst, i) => (
                    <div
                      key={`${inst.classId}-${inst.sectionId}-${i}`}
                      className={cn(
                        "rounded-xl border p-4",
                        inst.skipped || inst.duplicate
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "bg-card",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {inst.className}
                          {inst.sectionName ? ` · ${inst.sectionName}` : ""}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {inst.studentCount} students
                        </span>
                      </div>
                      {inst.skipReason && (
                        <p className="mt-1 text-xs text-amber-700">
                          {inst.skipReason}
                        </p>
                      )}
                      {inst.subjects.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Subjects:{" "}
                          {inst.subjects
                            .map(
                              (s) =>
                                `${s.subjectName}${s.teacherName ? ` (${s.teacherName})` : ""}`,
                            )
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {!preview.canCreate && (
                  <p className="text-sm text-destructive">
                    No valid exams to create. Resolve duplicates or add teacher
                    assignments first.
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-3 text-muted-foreground">
                <p>Could not load preview. Go back and check your selections.</p>
                <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => void loadPreview()}>
                  Retry preview
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky actions */}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={stepIndex === 0 || submitting}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        {step !== "preview" ? (
          <Button onClick={() => void goNext()}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => void handleCreate()}
            disabled={!preview?.canCreate || submitting}
          >
            {submitting ? "Creating…" : "Create Exam"}
          </Button>
        )}
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
