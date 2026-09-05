"use client";


import { useT, type TranslationKey } from "@/lib/i18n/provider";
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
import { academicYearNames, activeAcademicYear } from "@/lib/academics/store";
import {
  getState as getStudentsState,
  useStudentsState,
} from "@/lib/students/store";
import { nextAcademicYear } from "@ekulmis/shared";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { PromotionType } from "@/lib/promotions/types";

const TYPES: { id: PromotionType; label: TranslationKey; desc: string; icon: typeof User }[] = [
  { id: "INDIVIDUAL", label: "promotionsPromote.individual", desc: "Promote a single student", icon: User },
  { id: "CLASS", label: "promotionsPromote.class", desc: "Promote all eligible students in a class", icon: Users },
  { id: "SCHOOL_WIDE", label: "promotionsPromote.schoolWide", desc: "Promote every eligible class at once", icon: School },
];

export default function PromotePage() {
  const tr = useT();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const studentsState = useStudentsState();

  const [step, setStep] = useState(1);
  const [type, setType] = useState<PromotionType>("CLASS");

  /**
   * The year being promoted OUT of — which is not always the active one.
   *
   * The wizard used to read the active year and nothing else. A school that
   * had already opened 2026-2027 could then only promote from a year with
   * nobody in it: Haldoor's 172 students sat in 2025-2026, the wizard showed
   * "0 Total Students", and their Grade 1 kept listing the same children.
   *
   * The default is the most recent year that actually holds students, since
   * that is the one a promotion is for.
   */
  const yearsWithStudents = useMemo(() => {
    if (!mounted) return [];
    const held = new Set(
      getStudentsState()
        .students.filter((st) => st.status === "ACTIVE")
        .map((st) => st.academicYear),
    );
    return academicYearNames().filter((y) => held.has(y));
  }, [mounted, studentsState]);

  const [fromYearChoice, setFromYearChoice] = useState("");
  const year =
    fromYearChoice ||
    (yearsWithStudents.includes(activeAcademicYear())
      ? activeAcademicYear()
      : (yearsWithStudents[0] ?? activeAcademicYear()));
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

  // Promotion moves a school into the following year; showing which one is
  // the difference between "it did nothing" and "it worked".
  const toYear = useMemo(
    () => (mounted ? nextAcademicYear(year, academicYearNames()) : null),
    [mounted, year],
  );

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
        {tr("promotionsPromote.loading")}
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

  async function handleConfirm() {
    setConfirmOpen(false);

    if (type === "SCHOOL_WIDE") {
      const res = schoolWidePreview
        ? await promoteStudents({
            type: "SCHOOL_WIDE",
            academicYear: year,
            studentIds: schoolWidePreview.candidates.filter((c) => c.eligible).map((c) => c.studentId),
          })
        : { ok: false, error: "Nothing to promote.", promoted: 0, graduated: 0, skipped: 0 };
      finish(res);
      return;
    }

    const res = await promoteStudents({
      type,
      academicYear: year,
      studentIds: [...selected],
      toClass: preview?.graduating ? null : toClass || null,
      toSection: toSection || null,
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
        <ArrowLeft className="h-4 w-4" /> {tr("promotionsPromote.backToPromotions")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{tr("promotionsPromote.promotionWizard")}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {tr("promotionsPromote.promoteFrom")}
          </span>
          <Select
            value={year}
            onChange={(e) => setFromYearChoice(e.target.value)}
            className="h-8 w-auto py-0"
          >
            {(yearsWithStudents.length > 0
              ? yearsWithStudents
              : [activeAcademicYear()]
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <span className="text-muted-foreground">
            {tr("promotionsPromote.into")}
          </span>
          <span className="font-medium">
            {toYear ?? tr("promotionsPromote.noNextYear")}
          </span>
        </div>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {TYPES.map((pt) => (
            <button
              key={pt.id}
              onClick={() => setType(pt.id)}
              className={cn(
                "flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                type === pt.id && "border-primary ring-2 ring-primary/20",
              )}
            >
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", type === pt.id ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                <pt.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">{tr(pt.label)}</p>
                <p className="text-xs text-muted-foreground">{pt.desc}</p>
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
                <p className="font-medium text-sky-700 dark:text-sky-400">{tr("promotionsPromote.schoolWidePromotion")}</p>
                <p className="mt-1 text-muted-foreground">
                  {tr("promotionsPromote.everyEligibleStudentAdvancesOneClass")}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>{tr("promotionsPromote.currentClass")}</Label>
                <Select value={fromClass} onChange={(e) => setFromClass(e.target.value)}>
                  <option value="">{tr("promotionsPromote.selectClass")}</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{tr("promotionsPromote.currentSection")}</Label>
                <Select value={fromSection} onChange={(e) => setFromSection(e.target.value)} disabled={fromSections.length === 0}>
                  <option value="">{fromSections.length === 0 ? "No sections" : "All sections"}</option>
                  {fromSections.map((s) => (
                    <option key={s} value={s}>{tr("promotionsPromote.section")} {s}</option>
                  ))}
                </Select>
              </div>

              {type === "INDIVIDUAL" && fromClass && (
                <div className="sm:col-span-2">
                  <Label required>{tr("promotionsPromote.student")}</Label>
                  <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                    <option value="">{tr("promotionsPromote.selectStudent")}</option>
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
                  {fromClass} {tr("promotionsPromote.isTheFinalClassEligibleStudents")}
                </div>
              ) : (
                <>
                  <div>
                    <Label required>{tr("promotionsPromote.destinationClass")}</Label>
                    <Select value={toClass} onChange={(e) => setToClass(e.target.value)}>
                      <option value="">{tr("promotionsPromote.selectClass")}</option>
                      {classes.filter((c) => c !== fromClass).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>{tr("promotionsPromote.destinationSection")}</Label>
                    <Select value={toSection} onChange={(e) => setToSection(e.target.value)} disabled={toSections.length === 0}>
                      <option value="">{toSections.length === 0 ? "No sections" : "Keep / unassigned"}</option>
                      {toSections.map((s) => (
                        <option key={s} value={s}>{tr("promotionsPromote.section")} {s}</option>
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
                toYear={toYear}
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
                toYear={preview?.graduating ? null : toYear}
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
          <ArrowLeft className="me-2 h-4 w-4" /> {tr("promotionsPromote.back")}
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 2 && !canProceedFromStep2()}
          >
            {tr("promotionsPromote.next")} <ArrowRight className="ms-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={type !== "SCHOOL_WIDE" && selected.size === 0}
          >
            <Sparkles className="me-2 h-4 w-4" /> {tr("promotionsPromote.confirmPromotion")}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={tr("promotionsPromote.confirmPromotion")}
        message={
          type === "SCHOOL_WIDE"
            ? `Promote all ${schoolWidePreview?.candidates.filter((c) => c.eligible).length ?? 0} eligible students across the school? This preserves all historical records.`
            : `Promote ${selected.size} selected student(s)? This action is recorded and can be rolled back before new activities are logged.`
        }
        confirmLabel={tr("promotionsPromote.confirm")}
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
  toYear,
}: {
  total: number;
  eligible: number;
  graduating: number;
  destination?: string;
  /** The year students land in — the part of a promotion schools most need to see. */
  toYear?: string | null;
}) {
  const tr = useT();
  const where = destination ?? tr("promotionsPromote.autoOneGradeUp");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label={tr("promotionsPromote.totalStudents")} value={String(total)} />
      <Stat label={tr("promotionsPromote.selectedEligible")} value={String(eligible)} tone="emerald" />
      <Stat label={tr("promotionsPromote.graduating")} value={String(graduating)} tone="sky" />
      <Stat
        label={tr("promotionsPromote.destination")}
        value={toYear ? `${where} · ${toYear}` : where}
      />
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
