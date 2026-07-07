"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  School,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PreviewTable } from "@/components/promotions/preview-table";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  buildPreview,
  orderedClassNames,
  promoteStudents,
  sectionsForClassName,
  suggestedNextClass,
} from "@/lib/promotions/store";
import { activeAcademicYear } from "@/lib/academics/store";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { PromotionType } from "@/lib/promotions/types";

const TYPES: { id: PromotionType; label: string; desc: string; icon: typeof User }[] = [
  { id: "INDIVIDUAL", label: "Individual", desc: "Promote a single student", icon: User },
  { id: "CLASS", label: "Class", desc: "Promote all eligible students in a class", icon: Users },
  { id: "SCHOOL_WIDE", label: "School-Wide", desc: "Promote every eligible class at once", icon: School },
];

export default function PromotePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [step, setStep] = useState(1);
  const [type, setType] = useState<PromotionType>("CLASS");
  const year = activeAcademicYear();
  const classes = useMemo(() => orderedClassNames(year), [year, mounted]);

  const [fromClass, setFromClass] = useState("");
  const [fromSection, setFromSection] = useState("");
  const [toClass, setToClass] = useState("");
  const [toSection, setToSection] = useState("");
  const [studentId, setStudentId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fromSections = useMemo(
    () => (fromClass ? sectionsForClassName(fromClass, year) : []),
    [fromClass, year],
  );
  const toSections = useMemo(
    () => (toClass ? sectionsForClassName(toClass, year) : []),
    [toClass, year],
  );

  const students = useMemo(() => {
    if (type !== "INDIVIDUAL" || !fromClass) return [];
    return buildPreview({ academicYear: year, fromClass, fromSection: fromSection || null }).candidates;
  }, [type, fromClass, fromSection, year, mounted]);

  useEffect(() => {
    if (fromClass) {
      setToClass(suggestedNextClass(fromClass, year) ?? "");
      setToSection(fromSection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromClass]);

  const preview = useMemo(() => {
    if (step < 3 || !fromClass) return null;
    return buildPreview({
      academicYear: year,
      fromClass,
      fromSection: fromSection || null,
      toClass: toClass || null,
      toSection: toSection || null,
    });
  }, [step, fromClass, fromSection, toClass, toSection, year]);

  const schoolWidePreview = useMemo(() => {
    if (type !== "SCHOOL_WIDE" || step < 3) return null;
    const all = classes.flatMap((cls) =>
      buildPreview({ academicYear: year, fromClass: cls }).candidates,
    );
    return { candidates: all };
  }, [type, step, classes, year]);

  useEffect(() => {
    if (preview) {
      const auto = new Set(
        preview.candidates
          .filter((c) => c.eligible && (type !== "INDIVIDUAL" || c.studentId === studentId))
          .map((c) => c.studentId),
      );
      setSelected(auto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!preview) return;
    if (checked) {
      setSelected(new Set(preview.candidates.filter((c) => c.eligible).map((c) => c.studentId)));
    } else {
      setSelected(new Set());
    }
  }

  function canProceedFromStep2(): boolean {
    if (type === "SCHOOL_WIDE") return true;
    if (!fromClass) return false;
    if (type === "INDIVIDUAL" && !studentId) return false;
    return true;
  }

  function handleConfirm() {
    setConfirmOpen(false);

    if (type === "SCHOOL_WIDE") {
      const res = schoolWidePreview
        ? promoteStudents({
            type: "SCHOOL_WIDE",
            academicYear: year,
            studentIds: schoolWidePreview.candidates.filter((c) => c.eligible).map((c) => c.studentId),
            toAcademicYear: year,
          })
        : { ok: false, error: "Nothing to promote.", promoted: 0, graduated: 0, skipped: 0 };
      finish(res);
      return;
    }

    const res = promoteStudents({
      type,
      academicYear: year,
      studentIds: [...selected],
      toClass: preview?.graduating ? null : toClass || null,
      toSection: toSection || null,
      toAcademicYear: year,
    });
    finish(res);
  }

  function finish(res: { ok: boolean; error?: string; promoted: number; graduated: number; skipped: number }) {
    if (!res.ok) {
      toast(res.error ?? "Promotion failed.", "error");
      return;
    }
    toast(`Promotion complete: ${res.promoted} promoted, ${res.graduated} graduated, ${res.skipped} skipped.`, "success");
    router.push("/promotions/history");
  }

  return (
    <div className="space-y-6">
      <Link href="/promotions" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Promotions
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Promotion Wizard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Academic Year {year}</p>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={cn(
                "flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                type === t.id && "border-primary ring-2 ring-primary/20",
              )}
            >
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", type === t.id ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                <t.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          {type === "SCHOOL_WIDE" ? (
            <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm">
              <School className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <div>
                <p className="font-medium text-sky-700 dark:text-sky-400">School-Wide Promotion</p>
                <p className="mt-1 text-muted-foreground">
                  Every eligible student advances one class. Final-class students graduate automatically.
                  Review the full preview on the next step before confirming.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>Current Class</Label>
                <Select value={fromClass} onChange={(e) => setFromClass(e.target.value)}>
                  <option value="">Select class…</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Current Section</Label>
                <Select value={fromSection} onChange={(e) => setFromSection(e.target.value)} disabled={fromSections.length === 0}>
                  <option value="">{fromSections.length === 0 ? "No sections" : "All sections"}</option>
                  {fromSections.map((s) => (
                    <option key={s} value={s}>Section {s}</option>
                  ))}
                </Select>
              </div>

              {type === "INDIVIDUAL" && fromClass && (
                <div className="sm:col-span-2">
                  <Label required>Student</Label>
                  <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                    <option value="">Select student…</option>
                    {students.map((s) => (
                      <option key={s.studentId} value={s.studentId}>
                        {s.studentName} ({s.studentCode})
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {fromClass && !suggestedNextClass(fromClass, year) ? (
                <div className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-700 dark:text-sky-400">
                  <GraduationCap className="h-4 w-4" />
                  {fromClass} is the final class — eligible students will graduate.
                </div>
              ) : (
                <>
                  <div>
                    <Label required>Destination Class</Label>
                    <Select value={toClass} onChange={(e) => setToClass(e.target.value)}>
                      <option value="">Select class…</option>
                      {classes.filter((c) => c !== fromClass).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Destination Section</Label>
                    <Select value={toSection} onChange={(e) => setToSection(e.target.value)} disabled={toSections.length === 0}>
                      <option value="">{toSections.length === 0 ? "No sections" : "Keep / unassigned"}</option>
                      {toSections.map((s) => (
                        <option key={s} value={s}>Section {s}</option>
                      ))}
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {type === "SCHOOL_WIDE" ? (
            <>
              <PreviewSummary
                total={schoolWidePreview?.candidates.length ?? 0}
                eligible={schoolWidePreview?.candidates.filter((c) => c.eligible).length ?? 0}
                graduating={schoolWidePreview?.candidates.filter((c) => c.graduating && c.eligible).length ?? 0}
              />
              <PreviewTable candidates={schoolWidePreview?.candidates ?? []} />
            </>
          ) : (
            <>
              <PreviewSummary
                total={preview?.total ?? 0}
                eligible={selected.size}
                graduating={preview?.candidates.filter((c) => c.graduating && selected.has(c.studentId)).length ?? 0}
                destination={preview?.graduating ? "Graduation" : `${toClass}${toSection ? ` — Section ${toSection}` : ""}`}
              />
              <PreviewTable
                candidates={
                  type === "INDIVIDUAL"
                    ? (preview?.candidates ?? []).filter((c) => c.studentId === studentId)
                    : preview?.candidates ?? []
                }
                selectable={type !== "INDIVIDUAL"}
                selected={selected}
                onToggle={toggle}
                onToggleAll={toggleAll}
              />
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 2 && !canProceedFromStep2()}
          >
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={type !== "SCHOOL_WIDE" && selected.size === 0}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Confirm Promotion
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Promotion"
        message={
          type === "SCHOOL_WIDE"
            ? `Promote all ${schoolWidePreview?.candidates.filter((c) => c.eligible).length ?? 0} eligible students across the school? This preserves all historical records.`
            : `Promote ${selected.size} selected student(s)? This action is recorded and can be rolled back before new activities are logged.`
        }
        confirmLabel="Confirm"
        onConfirm={handleConfirm}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Promotion Type", "Selection", "Preview & Confirm"];
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : n}
            </span>
            <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            {i < steps.length - 1 && <span className="mx-2 hidden h-px flex-1 bg-border sm:block" />}
          </div>
        );
      })}
    </div>
  );
}

function PreviewSummary({
  total,
  eligible,
  graduating,
  destination,
}: {
  total: number;
  eligible: number;
  graduating: number;
  destination?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Total Students" value={String(total)} />
      <Stat label="Selected / Eligible" value={String(eligible)} tone="emerald" />
      <Stat label="Graduating" value={String(graduating)} tone="sky" />
      <Stat label="Destination" value={destination ?? "Auto (one grade up)"} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "sky" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className={cn(
        "text-lg font-bold tabular-nums",
        tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
        tone === "sky" && "text-sky-600 dark:text-sky-400",
      )}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
