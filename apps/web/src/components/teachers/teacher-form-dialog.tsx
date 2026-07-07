"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SALARY } from "@/lib/teachers/constants";
import { registerTeacher, updateTeacher, type Teacher } from "@/lib/teachers/store";
import type { EmploymentStatus, Gender, Shift } from "@/lib/teachers/types";

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
  shift: Shift;
  status: EmploymentStatus;
}

const empty: FormState = {
  fullName: "",
  gender: "MALE",
  phone: "",
  email: "",
  address: "",
  qualification: "",
  salary: String(DEFAULT_SALARY),
  shift: "MORNING",
  status: "ACTIVE",
};

export function TeacherFormDialog({ open, onClose, teacher, onSaved }: Props) {
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
        shift: teacher.shift,
        status: teacher.status,
      });
    } else {
      setForm(empty);
    }
  }, [open, teacher]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit() {
    setError(null);
    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!form.phone.trim()) return setError("Phone number is required.");
    const salary = Number(form.salary);
    if (Number.isNaN(salary) || salary < 0) return setError("Invalid salary.");

    if (isEdit && teacher) {
      const res = updateTeacher(teacher.id, {
        fullName: form.fullName,
        gender: form.gender,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
        qualification: form.qualification || null,
        salary,
        shift: form.shift,
        status: form.status,
      });
      if (!res.ok) return setError(res.error ?? "Update failed.");
      onSaved?.(`${res.teacher?.fullName} updated successfully.`);
      onClose();
      return;
    }

    const res = registerTeacher({
      fullName: form.fullName,
      gender: form.gender,
      phone: form.phone,
      email: form.email || null,
      address: form.address || null,
      qualification: form.qualification || null,
      salary,
      shift: form.shift,
      status: form.status,
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
            Cancel
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
          <Label required>Full Name</Label>
          <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </div>
        <div>
          <Label required>Gender</Label>
          <Select value={form.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
        </div>
        <div>
          <Label required>Phone Number</Label>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Address</Label>
          <Textarea value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div>
          <Label>Qualification</Label>
          <Input value={form.qualification} onChange={(e) => set("qualification", e.target.value)} />
        </div>
        <div>
          <Label required>Salary</Label>
          <Input type="number" min={0} value={form.salary} onChange={(e) => set("salary", e.target.value)} />
        </div>
        <div>
          <Label required>Shift</Label>
          <Select value={form.shift} onChange={(e) => set("shift", e.target.value as Shift)}>
            <option value="MORNING">Morning</option>
            <option value="AFTERNOON">Afternoon</option>
          </Select>
        </div>
        <div>
          <Label>Employment Status</Label>
          <Select value={form.status} onChange={(e) => set("status", e.target.value as EmploymentStatus)}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
      </div>
    </Dialog>
  );
}
