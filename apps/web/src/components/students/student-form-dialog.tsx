"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StudentPhotoUpload } from "@/components/students/student-photo-upload";
import { DEFAULT_MONTHLY_FEE } from "@/lib/students/constants";
import {
  activeAcademicYear,
  classByName,
  classNamesForYear,
  ensureAcademicsLoaded,
  sectionNamesForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { academicYearNames } from "@/lib/academics/year-select";
import {
  registerStudent,
  updateStudent,
  type StudentWithParent,
} from "@/lib/students/store";
import type { FeeStartMode, Gender, StudentPhotoChange, StudentStatus } from "@/lib/students/types";
import { useSettingsState } from "@/lib/settings/store";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  student?: StudentWithParent | null;
  onSaved?: (message: string, tone?: "success" | "error" | "info") => void;
}

interface FormState {
  fullName: string;
  gender: Gender;
  dob: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  className: string;
  section: string;
  monthlyFee: string;
  academicYear: string;
  status: StudentStatus;
  notes: string;
  feeStartMode: FeeStartMode;
  agreementAmount: string;
}

function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label required={required} className="mb-1 block text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

const inputClass = "h-9 w-full min-w-0 text-sm";

const empty = (year: string, className: string): FormState => ({
  fullName: "",
  gender: "MALE",
  dob: "",
  phone: "",
  parentName: "",
  parentPhone: "",
  className,
  section: "",
  monthlyFee: String(DEFAULT_MONTHLY_FEE),
  academicYear: year,
  status: "ACTIVE",
  notes: "",
  feeStartMode: "FULL_CURRENT",
  agreementAmount: "",
});

export function StudentFormDialog({ open, onClose, student, onSaved }: Props) {
  const isEdit = !!student;
  const settings = useSettingsState();
  const academics = useAcademicsState();
  const years = useMemo(
    () => academicYearNames(academics),
    [academics.academicYears],
  );
  const defaultYear = activeAcademicYear() || years[0] || "";
  const [form, setForm] = useState<FormState>(() =>
    empty(defaultYear, classNamesForYear(defaultYear)[0] ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const classList = useMemo(
    () => classNamesForYear(form.academicYear, { includeInactive: isEdit }),
    [form.academicYear, academics.classes, isEdit],
  );
  const selectedClass = useMemo(
    () => classByName(form.className, form.academicYear, { allowInactive: true }),
    [form.className, form.academicYear, academics.classes],
  );
  const sectionList = useMemo(() => {
    if (!selectedClass?.hasSections) return [];
    return sectionNamesForClass(form.className, form.academicYear);
  }, [form.className, form.academicYear, selectedClass?.hasSections, academics.sections]);

  useEffect(() => {
    if (!open) return;
    void ensureAcademicsLoaded();
    setError(null);
    setSaving(false);
    setPhotoFile(null);
    setRemovePhoto(false);
    setPhotoPreview(null);
    if (student) {
      setForm({
        fullName: student.fullName,
        gender: student.gender,
        dob: toDateInput(student.dob),
        phone: student.phone ?? "",
        parentName: student.parent.name,
        parentPhone: student.parent.phone,
        className: student.className,
        section: student.section ?? "",
        monthlyFee: String(student.monthlyFee),
        academicYear: student.academicYear,
        status: student.status,
        notes: student.notes ?? "",
        feeStartMode: "FULL_CURRENT",
        agreementAmount: "",
      });
    } else {
      const y = activeAcademicYear() || academicYearNames(academics)[0] || "";
      const classes = classNamesForYear(y);
      setForm(empty(y, classes[0] ?? ""));
      setPhotoPreview(null);
    }
    // Intentionally excludes `academics`/`years`: this effect should only
    // reset the form when the dialog opens or the target student changes,
    // not whenever the academics store re-emits (which was wiping the form
    // mid-keystroke whenever the store refreshed elsewhere in the app).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student?.id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function buildPhotoChange(): StudentPhotoChange | undefined {
    if (removePhoto) return { remove: true };
    if (photoFile) return { file: photoFile };
    return undefined;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (saving) return;
    setError(null);
    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!form.parentName.trim())
      return setError("Parent / guardian name is required.");
    if (!form.parentPhone.trim())
      return setError("Parent phone number is required.");
    const fee = Number(form.monthlyFee);
    if (Number.isNaN(fee) || fee < 0)
      return setError("Monthly fee must be a valid number.");
    if (!isEdit && form.feeStartMode === "AGREEMENT") {
      const agreement = Number(form.agreementAmount);
      if (Number.isNaN(agreement) || agreement < 0)
        return setError("Agreement amount must be a valid number.");
      if (agreement > fee)
        return setError("Agreement amount cannot exceed the monthly fee.");
    }

    setSaving(true);
    try {
      const photo = buildPhotoChange();

      if (isEdit && student) {
        const res = await updateStudent(
          student.id,
          {
            fullName: form.fullName,
            gender: form.gender,
            dob: form.dob || null,
            phone: form.phone || null,
            className: form.className,
            section: form.section || null,
            monthlyFee: fee,
            status: form.status,
            academicYear: form.academicYear,
            notes: form.notes || null,
            parentName: form.parentName,
            parentPhone: form.parentPhone,
          },
          photo,
        );
        if (!res.ok) return setError(res.error ?? "Failed to update student.");
        if (res.warning) {
          setError(
            `Student updated, but the profile photo could not be saved: ${res.warning}`,
          );
        }
        const warn = res.warning ? ` Note: ${res.warning}` : "";
        onSaved?.(
          `${res.student?.fullName} updated successfully.${warn}`,
          res.warning ? "error" : "success",
        );
        if (!res.warning) onClose();
        return;
      }

      const res = await registerStudent(
        {
          fullName: form.fullName,
          gender: form.gender,
          dob: form.dob || null,
          phone: form.phone || null,
          parentName: form.parentName,
          parentPhone: form.parentPhone,
          className: form.className,
          section: form.section || null,
          monthlyFee: fee,
          academicYear: form.academicYear,
          status: form.status,
          notes: form.notes || null,
          feeStartMode: form.feeStartMode,
          agreementAmount:
            form.feeStartMode === "AGREEMENT"
              ? Number(form.agreementAmount)
              : undefined,
        },
        { photo },
      );
      if (!res.ok) return setError(res.error ?? "Failed to register student.");
      const idMsg = res.student ? ` Student ID: ${res.student.code}.` : "";
      const parentMsg = res.parentCreated
        ? ` New parent login — ID: ${res.parentCode}, Password: ${res.initialParentPassword ?? "(reset from Parents page)"}. Share these with the parent.`
        : " Linked to existing parent.";
      if (res.warning) {
        setError(
          `Student registered successfully, but the profile photo could not be saved: ${res.warning}`,
        );
      }
      const warn = res.warning ? ` Photo: ${res.warning}` : "";
      onSaved?.(
        `${res.student?.fullName} registered.${idMsg}${parentMsg}${warn}`,
        res.warning ? "error" : "success",
      );
      if (!res.warning) onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      scrollable={false}
      title={isEdit ? "Edit Student" : "Register Student"}
      description={
        isEdit
          ? `Update ${student?.code} — ID does not change.`
          : "Student ID and parent account are created automatically."
      }
      className="sm:max-w-4xl lg:max-w-5xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEdit ? "Saving…" : "Registering…"}
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Register Student"
            )}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Photo — spans 2 rows on large screens */}
          <div className="flex justify-center sm:col-span-2 sm:justify-start lg:row-span-2 lg:col-span-1">
            <StudentPhotoUpload
              previewUrl={photoPreview}
              studentId={student?.id}
              hasExistingPhoto={!!(student?.hasPhoto || student?.photoUrl) && !removePhoto}
              existingPhotoUrl={removePhoto ? null : student?.photoUrl}
              onPreviewChange={setPhotoPreview}
              onFileChange={(file) => {
                setPhotoFile(file);
                if (file) setRemovePhoto(false);
              }}
              onRemoveExisting={() => setRemovePhoto(true)}
              disabled={saving}
              compact
              minimal
            />
          </div>

          <Field label="Full Name" required className="sm:col-span-2 lg:col-span-3">
            <Input
              className={inputClass}
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="e.g. Amina Hassan"
              autoFocus
            />
          </Field>

          <Field label="Gender" required>
            <Select
              className={inputClass}
              value={form.gender}
              onChange={(e) => set("gender", e.target.value as Gender)}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </Select>
          </Field>
          <Field label="Date of Birth">
            <Input
              className={inputClass}
              type="date"
              value={form.dob}
              onChange={(e) => set("dob", e.target.value)}
            />
          </Field>
          <Field label="Student Phone" className="sm:col-span-2 lg:col-span-1">
            <Input
              className={inputClass}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Field label="Parent / Guardian Name" required className="sm:col-span-2">
            <Input
              className={inputClass}
              value={form.parentName}
              onChange={(e) => set("parentName", e.target.value)}
              placeholder="e.g. Mohamed Hassan"
            />
          </Field>
          <Field label="Parent Phone" required className="sm:col-span-2">
            <Input
              className={inputClass}
              value={form.parentPhone}
              onChange={(e) => set("parentPhone", e.target.value)}
              placeholder="Reused if exists"
            />
          </Field>

          <Field label="Class" required>
            <Select
              className={inputClass}
              value={form.className}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  className: e.target.value,
                  section: "",
                }))
              }
            >
              {classList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Section">
            <Select
              className={inputClass}
              value={form.section}
              onChange={(e) => set("section", e.target.value)}
              disabled={!selectedClass?.hasSections || sectionList.length === 0}
            >
              <option value="">
                {selectedClass?.hasSections ? "Select" : "—"}
              </option>
              {sectionList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Academic Year">
            <Select
              className={inputClass}
              value={form.academicYear}
              onChange={(e) => {
                const nextYear = e.target.value;
                const classes = classNamesForYear(nextYear);
                setForm((f) => ({
                  ...f,
                  academicYear: nextYear,
                  className: classes.includes(f.className)
                    ? f.className
                    : classes[0] ?? "",
                  section: "",
                }));
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Monthly Fee" required>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                $
              </span>
              <Input
                className={cn(inputClass, "pl-6")}
                type="number"
                min={0}
                value={form.monthlyFee}
                onChange={(e) => set("monthlyFee", e.target.value)}
              />
            </div>
          </Field>
          <Field label="Status">
            <Select
              className={inputClass}
              value={form.status}
              onChange={(e) => set("status", e.target.value as StudentStatus)}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="GRADUATED">Graduated</option>
            </Select>
          </Field>
          <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
            <Input
              className={inputClass}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>

        {!isEdit && (
          <div className="mt-4 rounded-xl border bg-secondary/20 p-4">
            <p className="text-sm font-semibold">Fee Start Configuration</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose how tuition begins for this student
              {settings.fees.billingMode === "ACADEMIC_YEAR"
                ? " (remaining academic months are calculated automatically)."
                : "."}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    value: "FULL_CURRENT" as const,
                    title: "Charge Full Current Month",
                    desc: "Bill the full monthly fee for the admission month.",
                  },
                  {
                    value: "AGREEMENT" as const,
                    title: "Agreement / Special Fee",
                    desc: "Charge a custom amount for the first month only.",
                  },
                  {
                    value: "NEXT_MONTH" as const,
                    title: "Start Billing From Next Month",
                    desc: "Skip the current month; billing begins next month.",
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                    form.feeStartMode === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-card hover:bg-secondary/40",
                  )}
                >
                  <input
                    type="radio"
                    name="feeStartMode"
                    className="mt-1"
                    checked={form.feeStartMode === opt.value}
                    onChange={() => set("feeStartMode", opt.value)}
                  />
                  <span>
                    <span className="block text-sm font-medium">{opt.title}</span>
                    <span className="block text-xs text-muted-foreground">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            {form.feeStartMode === "AGREEMENT" && (
              <Field label="Agreement Amount" required className="mt-3 max-w-xs">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    $
                  </span>
                  <Input
                    className={cn(inputClass, "pl-6")}
                    type="number"
                    min={0}
                    value={form.agreementAmount}
                    onChange={(e) => set("agreementAmount", e.target.value)}
                    placeholder="e.g. 8"
                  />
                </div>
              </Field>
            )}
          </div>
        )}
      </form>
    </Dialog>
  );
}
