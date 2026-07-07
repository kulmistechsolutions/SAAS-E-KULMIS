"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ACADEMIC_YEARS,
  ACTIVE_ACADEMIC_YEAR,
  CLASSES,
  DEFAULT_MONTHLY_FEE,
  SECTIONS,
} from "@/lib/students/constants";
import {
  registerStudent,
  updateStudent,
  type StudentWithParent,
} from "@/lib/students/store";
import type { Gender, StudentStatus } from "@/lib/students/types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When provided the dialog is in edit mode. */
  student?: StudentWithParent | null;
  onSaved?: (message: string) => void;
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
}

function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const empty: FormState = {
  fullName: "",
  gender: "MALE",
  dob: "",
  phone: "",
  parentName: "",
  parentPhone: "",
  className: CLASSES[0],
  section: "",
  monthlyFee: String(DEFAULT_MONTHLY_FEE),
  academicYear: ACTIVE_ACADEMIC_YEAR,
  status: "ACTIVE",
  notes: "",
};

export function StudentFormDialog({ open, onClose, student, onSaved }: Props) {
  const isEdit = !!student;
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
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
      });
    } else {
      setForm(empty);
    }
  }, [open, student]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit() {
    setError(null);
    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!form.parentName.trim()) return setError("Parent / guardian name is required.");
    if (!form.parentPhone.trim()) return setError("Parent phone number is required.");
    const fee = Number(form.monthlyFee);
    if (Number.isNaN(fee) || fee < 0) return setError("Monthly fee must be a valid number.");

    if (isEdit && student) {
      const res = updateStudent(student.id, {
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
      });
      if (!res.ok) return setError(res.error ?? "Failed to update student.");
      onSaved?.(`${res.student?.fullName} updated successfully.`);
      onClose();
      return;
    }

    const res = registerStudent({
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
    });
    if (!res.ok) return setError(res.error ?? "Failed to register student.");
    const idMsg = res.student ? ` Student ID: ${res.student.code}.` : "";
    const parentMsg = res.parentCreated
      ? ` New parent account ${res.parentCode} created.`
      : " Linked to existing parent.";
    onSaved?.(`${res.student?.fullName} registered.${idMsg}${parentMsg}`);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Student" : "Register Student"}
      description={
        isEdit
          ? `Update details for ${student?.code}. The Student ID never changes.`
          : "A unique Student ID and parent account are created automatically."
      }
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isEdit ? "Save Changes" : "Register Student"}
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
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Student Details
          </p>
        </div>

        <div>
          <Label required>Full Name</Label>
          <Input
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="e.g. Amina Hassan"
          />
        </div>
        <div>
          <Label required>Gender</Label>
          <Select
            value={form.gender}
            onChange={(e) => set("gender", e.target.value as Gender)}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
        </div>
        <div>
          <Label>Date of Birth</Label>
          <Input
            type="date"
            value={form.dob}
            onChange={(e) => set("dob", e.target.value)}
          />
        </div>
        <div>
          <Label>Student Phone</Label>
          <Input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="sm:col-span-2 mt-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Parent / Guardian
          </p>
        </div>
        <div>
          <Label required>Parent / Guardian Name</Label>
          <Input
            value={form.parentName}
            onChange={(e) => set("parentName", e.target.value)}
            placeholder="e.g. Mohamed Hassan"
          />
        </div>
        <div>
          <Label required>Parent Phone Number</Label>
          <Input
            value={form.parentPhone}
            onChange={(e) => set("parentPhone", e.target.value)}
            placeholder="Reused if it already exists"
          />
        </div>

        <div className="sm:col-span-2 mt-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Academic
          </p>
        </div>
        <div>
          <Label required>Class</Label>
          <Select
            value={form.className}
            onChange={(e) => set("className", e.target.value)}
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Section</Label>
          <Select
            value={form.section}
            onChange={(e) => set("section", e.target.value)}
          >
            <option value="">— None —</option>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>Monthly Fee</Label>
          <Input
            type="number"
            min={0}
            value={form.monthlyFee}
            onChange={(e) => set("monthlyFee", e.target.value)}
          />
        </div>
        <div>
          <Label>Academic Year</Label>
          <Select
            value={form.academicYear}
            onChange={(e) => set("academicYear", e.target.value)}
          >
            {ACADEMIC_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onChange={(e) => set("status", e.target.value as StudentStatus)}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="GRADUATED">Graduated</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional notes about this student"
          />
        </div>
      </div>
    </Dialog>
  );
}
