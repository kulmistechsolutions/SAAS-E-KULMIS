"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useRef, useState } from "react";
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
  groupClassNames,
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
import { ensureVillagesLoaded, useVillagesState } from "@/lib/villages/store";
import { ensureDistrictsLoaded, useDistrictsState } from "@/lib/districts/store";
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
  placeOfBirth: string;
  district: string;
  motherName: string;
  parentName: string;
  parentPhone: string;
  className: string;
  section: string;
  village: string;
  monthlyFee: string;
  academicYear: string;
  status: StudentStatus;
  notes: string;
  feeStartMode: FeeStartMode;
  agreementAmount: string;
  feeWaived: boolean;
  chargeRegistrationFee: boolean;
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
  placeOfBirth: "",
  district: "",
  motherName: "",
  parentName: "",
  parentPhone: "",
  className,
  section: "",
  village: "",
  monthlyFee: String(DEFAULT_MONTHLY_FEE),
  academicYear: year,
  status: "ACTIVE",
  notes: "",
  feeStartMode: "FULL_CURRENT",
  agreementAmount: "",
  feeWaived: false,
  chargeRegistrationFee: false,
});

export function StudentFormDialog({ open, onClose, student, onSaved }: Props) {
  const t = useT();
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
  // Whether the desk has actually made a choice about the registration fee.
  // Until it has, the tick box follows the school's setting as that setting
  // arrives — the settings store starts on its seed defaults, so a dialog
  // opened before the real ones land would otherwise sit on a default nobody
  // picked and quietly register the student without the fee.
  const registrationFeeTouched = useRef(false);

  const classList = useMemo(
    () => classNamesForYear(form.academicYear, { includeInactive: isEdit }),
    [form.academicYear, academics.classes, isEdit],
  );
  const classGroups = useMemo(
    () =>
      groupClassNames(classList, form.academicYear, t("common.defaultGrades")),
    [classList, form.academicYear, academics.structureTrees, t],
  );
  const selectedClass = useMemo(
    () => classByName(form.className, form.academicYear, { allowInactive: true }),
    [form.className, form.academicYear, academics.classes],
  );
  const sectionList = useMemo(() => {
    if (!selectedClass?.hasSections) return [];
    return sectionNamesForClass(form.className, form.academicYear);
  }, [form.className, form.academicYear, selectedClass?.hasSections, academics.sections]);
  const villages = useVillagesState();
  const districts = useDistrictsState();
  // Which registration form this school fills in. The extra bio fields are
  // additive — everything the standard form asks for stays exactly as it is.
  const detailed = settings.students.formTemplate === "DETAILED";

  useEffect(() => {
    if (!open) return;
    void ensureAcademicsLoaded();
    void ensureVillagesLoaded();
    void ensureDistrictsLoaded();
    setError(null);
    setSaving(false);
    setPhotoFile(null);
    setRemovePhoto(false);
    setPhotoPreview(null);
    registrationFeeTouched.current = false;
    if (student) {
      setForm({
        fullName: student.fullName,
        gender: student.gender,
        dob: toDateInput(student.dob),
        phone: student.phone ?? "",
        placeOfBirth: student.placeOfBirth ?? "",
        district: student.district ?? "",
        motherName: student.motherName ?? "",
        parentName: student.parent.name,
        parentPhone: student.parent.phone,
        className: student.className,
        section: student.section ?? "",
        village: student.village ?? "",
        monthlyFee: String(student.monthlyFee),
        academicYear: student.academicYear,
        status: student.status,
        notes: student.notes ?? "",
        feeStartMode: "FULL_CURRENT",
        agreementAmount: "",
        feeWaived: student.feeWaived ?? false,
        chargeRegistrationFee: false,
      });
    } else {
      const y = activeAcademicYear() || academicYearNames(academics)[0] || "";
      const classes = classNamesForYear(y);
      setForm({
        ...empty(y, classes[0] ?? ""),
        chargeRegistrationFee: settings.fees.registrationFeeAmount > 0,
      });
      setPhotoPreview(null);
    }
    // Intentionally excludes `academics`/`years`: this effect should only
    // reset the form when the dialog opens or the target student changes,
    // not whenever the academics store re-emits (which was wiping the form
    // mid-keystroke whenever the store refreshed elsewhere in the app).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student?.id]);

  // The settings store hands back its seed defaults until the school's real
  // ones arrive, and registrationFeeAmount seeds to 0 — so a dialog opened in
  // that window starts with the fee off and the tick box not rendered at all.
  // When the true amount lands, take the default the school configured,
  // unless the desk has already decided for itself.
  useEffect(() => {
    if (!open || isEdit || registrationFeeTouched.current) return;
    const shouldCharge = settings.fees.registrationFeeAmount > 0;
    setForm((f) =>
      f.chargeRegistrationFee === shouldCharge
        ? f
        : { ...f, chargeRegistrationFee: shouldCharge },
    );
  }, [open, isEdit, settings.fees.registrationFeeAmount]);

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
    // Only enforced at registration — an already-registered student isn't
    // retroactively blocked from being saved just because a school turned
    // this requirement on afterwards.
    if (!isEdit && settings.students.villageRequired && !form.village.trim())
      return setError("Village is required.");
    if (!isEdit && settings.students.districtRequired && !form.district.trim())
      return setError("District is required.");
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
            placeOfBirth: form.placeOfBirth || null,
            district: form.district || null,
            motherName: form.motherName || null,
            className: form.className,
            section: form.section || null,
            village: form.village || null,
            monthlyFee: fee,
            feeWaived: form.feeWaived,
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
        // A parent correction moves the child, so say where they landed —
        // otherwise a school cannot tell a fixed typo from a re-linked family.
        const movedMsg = res.parentCreated
          ? ` Moved to a new parent — ID: ${res.parentCode}, Password: ${res.initialParentPassword ?? "(reset from Parents page)"}. Share these with the parent.`
          : res.movedToParentName
            ? ` Moved to existing parent ${res.movedToParentName}.`
            : "";
        onSaved?.(
          `${res.student?.fullName} updated successfully.${movedMsg}${warn}`,
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
          placeOfBirth: form.placeOfBirth || null,
          district: form.district || null,
          motherName: form.motherName || null,
          parentName: form.parentName,
          parentPhone: form.parentPhone,
          className: form.className,
          section: form.section || null,
          village: form.village || null,
          monthlyFee: fee,
          academicYear: form.academicYear,
          status: form.status,
          notes: form.notes || null,
          feeStartMode: form.feeStartMode,
          agreementAmount:
            form.feeStartMode === "AGREEMENT"
              ? Number(form.agreementAmount)
              : undefined,
          feeWaived: form.feeWaived,
          // Only an opinion the desk could actually see and act on is sent.
          // Until settings arrive, registrationFeeAmount reads 0, the tick
          // box is not rendered at all, and this field would otherwise carry
          // a `false` nobody chose — which the server would honour as "waive
          // it". Left undefined, the server charges the fee the school has
          // configured, which is what the school set it up for.
          chargeRegistrationFee:
            settings.fees.registrationFeeAmount > 0
              ? form.chargeRegistrationFee
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
            {t("studentsStudentFormDialog.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
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

          <Field label={t("studentsStudentFormDialog.fullName")} required className="sm:col-span-2 lg:col-span-3">
            <Input
              className={inputClass}
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder={t("studentsStudentFormDialog.eGAminaHassan")}
              autoFocus
            />
          </Field>

          <Field label={t("studentsStudentFormDialog.gender")} required>
            <Select
              className={inputClass}
              value={form.gender}
              onChange={(e) => set("gender", e.target.value as Gender)}
            >
              <option value="MALE">{t("studentsStudentFormDialog.male")}</option>
              <option value="FEMALE">{t("studentsStudentFormDialog.female")}</option>
            </Select>
          </Field>
          <Field label={t("studentsStudentFormDialog.dateOfBirth")}>
            <Input
              className={inputClass}
              type="date"
              value={form.dob}
              onChange={(e) => set("dob", e.target.value)}
            />
          </Field>
          <Field label={t("studentsStudentFormDialog.studentPhone")} className="sm:col-span-2 lg:col-span-1">
            <Input
              className={inputClass}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder={t("studentsStudentFormDialog.optional")}
            />
          </Field>

          {detailed && (
            <>
              <Field label={t("studentsStudentFormDialog.placeOfBirth")}>
                <Input
                  className={inputClass}
                  value={form.placeOfBirth}
                  onChange={(e) => set("placeOfBirth", e.target.value)}
                  placeholder={t("studentsStudentFormDialog.optional")}
                />
              </Field>
              <Field
                label={t("studentsStudentFormDialog.district")}
                required={settings.students.districtRequired}
              >
                <Select
                  className={inputClass}
                  value={form.district}
                  onChange={(e) => set("district", e.target.value)}
                  disabled={districts.length === 0}
                >
                  <option value="">
                    {districts.length === 0
                      ? t("studentsStudentFormDialog.noDistrictsSetUp")
                      : t("studentsStudentFormDialog.selectDistrict")}
                  </option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t("studentsStudentFormDialog.motherName")}
                className="sm:col-span-2"
              >
                <Input
                  className={inputClass}
                  value={form.motherName}
                  onChange={(e) => set("motherName", e.target.value)}
                  placeholder={t("studentsStudentFormDialog.optional")}
                />
              </Field>
            </>
          )}

          <Field label={t("studentsStudentFormDialog.parentGuardianName")} required className="sm:col-span-2">
            <Input
              className={inputClass}
              value={form.parentName}
              onChange={(e) => set("parentName", e.target.value)}
              placeholder={t("studentsStudentFormDialog.eGMohamedHassan")}
            />
          </Field>
          <Field label={t("studentsStudentFormDialog.parentPhone")} required className="sm:col-span-2">
            <Input
              className={inputClass}
              value={form.parentPhone}
              onChange={(e) => set("parentPhone", e.target.value)}
              placeholder={t("studentsStudentFormDialog.reusedIfExists")}
            />
          </Field>

          <Field label={t("studentsStudentFormDialog.class")} required>
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
              {classGroups.map((g) =>
                g.label === null ? (
                  g.names.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                ) : (
                  <optgroup key={g.label} label={g.label}>
                    {g.names.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </Select>
          </Field>
          <Field label={t("studentsStudentFormDialog.section")}>
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
          <Field
            label={t("studentsStudentFormDialog.village")}
            required={settings.students.villageRequired}
          >
            <Select
              className={inputClass}
              value={form.village}
              onChange={(e) => set("village", e.target.value)}
              disabled={villages.length === 0}
            >
              <option value="">
                {villages.length === 0
                  ? t("studentsStudentFormDialog.noVillagesSetUp")
                  : t("studentsStudentFormDialog.none")}
              </option>
              {villages.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("studentsStudentFormDialog.academicYear")}>
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
          <Field label={t("studentsStudentFormDialog.monthlyFee")} required>
            <div className="relative">
              <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                $
              </span>
              <Input
                className={cn(inputClass, "ps-6")}
                type="number"
                min={0}
                disabled={form.feeWaived}
                value={form.monthlyFee}
                onChange={(e) => set("monthlyFee", e.target.value)}
              />
            </div>
            <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.feeWaived}
                onChange={(e) => set("feeWaived", e.target.checked)}
              />
              {t("studentsStudentFormDialog.feeWaived")}
            </label>
          </Field>
          <Field label={t("studentsStudentFormDialog.status")}>
            <Select
              className={inputClass}
              value={form.status}
              onChange={(e) => set("status", e.target.value as StudentStatus)}
            >
              <option value="ACTIVE">{t("studentsStudentFormDialog.active")}</option>
              <option value="INACTIVE">{t("studentsStudentFormDialog.inactive")}</option>
              <option value="GRADUATED">{t("studentsStudentFormDialog.graduated")}</option>
            </Select>
          </Field>
          <Field label={t("studentsStudentFormDialog.notes")} className="sm:col-span-2 lg:col-span-3">
            <Input
              className={inputClass}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={t("studentsStudentFormDialog.optional")}
            />
          </Field>
        </div>

        {!isEdit && (
          <div className="mt-4 rounded-xl border bg-secondary/20 p-4">
            <p className="text-sm font-semibold">{t("studentsStudentFormDialog.feeStartConfiguration")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("studentsStudentFormDialog.chooseHowTuitionBeginsForThis")}
              {settings.fees.billingMode === "ACADEMIC_YEAR"
                ? " (remaining academic months are calculated automatically)."
                : "."}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    value: "FULL_CURRENT" as const,
                    title: t("studentsStudentFormDialog.chargeFullCurrentMonth"),
                    desc: "Bill the full monthly fee for the admission month.",
                  },
                  {
                    value: "AGREEMENT" as const,
                    title: t("studentsStudentFormDialog.agreementSpecialFee"),
                    desc: "Charge a custom amount for the first month only.",
                  },
                  {
                    value: "NEXT_MONTH" as const,
                    title: t("studentsStudentFormDialog.startBillingFromNextMonth"),
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
              <Field label={t("studentsStudentFormDialog.agreementAmount")} required className="mt-3 max-w-xs">
                <div className="relative">
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    $
                  </span>
                  <Input
                    className={cn(inputClass, "ps-6")}
                    type="number"
                    min={0}
                    value={form.agreementAmount}
                    onChange={(e) => set("agreementAmount", e.target.value)}
                    placeholder={t("studentsStudentFormDialog.eG8")}
                  />
                </div>
              </Field>
            )}
            {settings.fees.registrationFeeAmount > 0 && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-card p-3 text-sm hover:bg-secondary/40">
                <input
                  type="checkbox"
                  checked={form.chargeRegistrationFee}
                  onChange={(e) => {
                    registrationFeeTouched.current = true;
                    set("chargeRegistrationFee", e.target.checked);
                  }}
                />
                <span>
                  {t("studentsStudentFormDialog.chargeRegistrationFee")}
                  {" — $"}
                  {settings.fees.registrationFeeAmount}
                </span>
              </label>
            )}
          </div>
        )}
      </form>
    </Dialog>
  );
}
