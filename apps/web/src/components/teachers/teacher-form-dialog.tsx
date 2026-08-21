"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DEFAULT_SALARY, DEFAULT_TEACHER_PASSWORD } from "@/lib/teachers/constants";
import { registerTeacher, updateTeacher, type Teacher } from "@/lib/teachers/store";
import { useShifts } from "@/lib/teachers/shifts";
import type { EmploymentStatus, Gender, Shift } from "@/lib/teachers/types";

/** Checkbox dropdown for picking one or more of the school's own shifts
 *  (Settings → Attendance → Attendance Shift Management) — a teacher who
 *  works every shift the school runs just has every box checked. */
function ShiftMultiSelect({
  value,
  onChange,
}: {
  value: Shift[];
  onChange: (next: Shift[]) => void;
}) {
  const t = useT();
  const shifts = useShifts();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options: { value: Shift; label: string }[] = shifts.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  function toggle(shift: Shift) {
    onChange(
      value.includes(shift) ? value.filter((s) => s !== shift) : [...value, shift],
    );
  }

  const summary = options
    .filter((o) => value.includes(o.value))
    .map((o) => o.label)
    .join(", ");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm"
      >
        <span className={cn(!summary && "text-muted-foreground")}>
          {summary || t("teachersTeacherFormDialog.selectShifts")}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover p-1.5 shadow-md">
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {t("teachersTeacherFormDialog.noShiftsSetUp")}
            </p>
          ) : (
            options.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={value.includes(o.value)}
                  onChange={() => toggle(o.value)}
                />
                {o.label}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  teacher?: Teacher | null;
  onSaved?: (message: string) => void;
}

interface FormState {
  fullName: string;
  gender: Gender;
  phone: string;
  email: string;
  address: string;
  qualification: string;
  salary: string;
  shifts: Shift[];
  status: EmploymentStatus;
  canViewStudents: boolean;
  password: string;
}

const empty: FormState = {
  fullName: "",
  gender: "MALE",
  phone: "",
  email: "",
  address: "",
  qualification: "",
  salary: String(DEFAULT_SALARY),
  shifts: [],
  status: "ACTIVE",
  canViewStudents: false,
  password: DEFAULT_TEACHER_PASSWORD,
};

export function TeacherFormDialog({ open, onClose, teacher, onSaved }: Props) {
  const t = useT();
  const isEdit = !!teacher;
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (teacher) {
      setForm({
        fullName: teacher.fullName,
        gender: teacher.gender,
        phone: teacher.phone,
        email: teacher.email ?? "",
        address: teacher.address ?? "",
        qualification: teacher.qualification ?? "",
        salary: String(teacher.salary),
        shifts: teacher.shifts,
        status: teacher.status,
        canViewStudents: teacher.canViewStudents ?? false,
        password: teacher.password || DEFAULT_TEACHER_PASSWORD,
      });
    } else {
      setForm(empty);
    }
  }, [open, teacher]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!form.phone.trim()) return setError("Phone number is required.");
    const salary = Number(form.salary);
    if (Number.isNaN(salary) || salary < 0) return setError("Invalid salary.");
    if (form.shifts.length === 0) return setError("Select at least one shift.");
    if (!isEdit) {
      if (!form.password.trim()) return setError("Login password is required.");
      if (form.password.trim().length < 5)
        return setError("Password must be at least 5 characters.");
    }

    if (isEdit && teacher) {
      const res = await updateTeacher(teacher.id, {
        fullName: form.fullName,
        gender: form.gender,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
        qualification: form.qualification || null,
        salary,
        shifts: form.shifts,
        status: form.status,
        canViewStudents: form.canViewStudents,
      });
      if (!res.ok) return setError(res.error ?? "Update failed.");
      onSaved?.(`${res.teacher?.fullName} updated successfully.`);
      onClose();
      return;
    }

    const res = await registerTeacher({
      fullName: form.fullName,
      gender: form.gender,
      phone: form.phone,
      email: form.email || null,
      address: form.address || null,
      qualification: form.qualification || null,
      salary,
      shifts: form.shifts,
      status: form.status,
      password: form.password.trim(),
    });
    if (!res.ok) return setError(res.error ?? "Registration failed.");
    onSaved?.(
      `${res.teacher?.fullName} registered. ID: ${res.teacher?.code}. Password: ${res.password}`,
    );
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Teacher" : "Register Teacher"}
      description={
        isEdit
          ? `Update ${teacher?.code}. Teacher ID and username cannot change.`
          : "A unique Teacher ID and login account are created automatically."
      }
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("teachersTeacherFormDialog.cancel")}
          </Button>
          <Button onClick={handleSubmit}>
            {isEdit ? "Save Changes" : "Register Teacher"}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label required>{t("teachersTeacherFormDialog.fullName")}</Label>
          <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </div>
        <div>
          <Label required>{t("teachersTeacherFormDialog.gender")}</Label>
          <Select value={form.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
            <option value="MALE">{t("teachersTeacherFormDialog.male")}</option>
            <option value="FEMALE">{t("teachersTeacherFormDialog.female")}</option>
          </Select>
        </div>
        <div>
          <Label required>{t("teachersTeacherFormDialog.phoneNumber")}</Label>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <Label>{t("teachersTeacherFormDialog.email")}</Label>
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("teachersTeacherFormDialog.address")}</Label>
          <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div>
          <Label>{t("teachersTeacherFormDialog.qualification")}</Label>
          <Input value={form.qualification} onChange={(e) => set("qualification", e.target.value)} />
        </div>
        <div>
          <Label required>{t("teachersTeacherFormDialog.salary")}</Label>
          <Input type="number" min={0} value={form.salary} onChange={(e) => set("salary", e.target.value)} />
        </div>
        <div>
          <Label required>{t("teachersTeacherFormDialog.shift")}</Label>
          <ShiftMultiSelect
            value={form.shifts}
            onChange={(shifts) => set("shifts", shifts)}
          />
        </div>
        <div>
          <Label>{t("teachersTeacherFormDialog.employmentStatus")}</Label>
          <Select value={form.status} onChange={(e) => set("status", e.target.value as EmploymentStatus)}>
            <option value="ACTIVE">{t("teachersTeacherFormDialog.active")}</option>
            <option value="INACTIVE">{t("teachersTeacherFormDialog.inactive")}</option>
          </Select>
        </div>
        {isEdit ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.canViewStudents}
              onChange={(e) => set("canViewStudents", e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            {t("teachersTeacherFormDialog.grantViewStudentsPermissionAssignedClasses")}
          </label>
        ) : (
          <div className="sm:col-span-2">
            <Label required>{t("teachersTeacherFormDialog.loginPassword")}</Label>
            <Input
              type="text"
              className="mt-1 font-mono"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={DEFAULT_TEACHER_PASSWORD}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("teachersTeacherFormDialog.defaultSamplePasswordIs")} {DEFAULT_TEACHER_PASSWORD}{t("teachersTeacherFormDialog.visibleToAdminOnly")}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
