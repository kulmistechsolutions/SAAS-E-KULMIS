"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { createEmployee, updateEmployee } from "@/lib/employees/store";
import type { EmploymentStatus, StaffEmployee } from "@/lib/employees/types";

interface Props {
  open: boolean;
  onClose: () => void;
  employee?: StaffEmployee | null;
}

const SUGGESTED_POSITIONS = [
  "Security Staff",
  "Cleaner",
  "Cook",
  "Driver",
  "Receptionist",
  "Other Staff",
];

export function EmployeeFormDialog({ open, onClose, employee }: Props) {
  const t = useT();
  const isEdit = !!employee;
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [salary, setSalary] = useState("");
  const [status, setStatus] = useState<EmploymentStatus>("ACTIVE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (employee) {
      setFullName(employee.fullName);
      setPosition(employee.position);
      setPhone(employee.phone ?? "");
      setSalary(String(employee.salary));
      setStatus(employee.status);
      setNotes(employee.notes ?? "");
    } else {
      setFullName("");
      setPosition("");
      setPhone("");
      setSalary("");
      setStatus("ACTIVE");
      setNotes("");
    }
  }, [open, employee]);

  async function submit() {
    setError(null);
    if (!fullName.trim()) return setError(t("salaryEmployeeFormDialog.fullNameRequired"));
    if (!position.trim()) return setError(t("salaryEmployeeFormDialog.positionRequired"));
    setSaving(true);
    const input = {
      fullName: fullName.trim(),
      position: position.trim(),
      phone: phone.trim() || null,
      salary: Number(salary) || 0,
      status,
      notes: notes.trim() || null,
    };
    const res =
      isEdit && employee
        ? await updateEmployee(employee.id, input)
        : await createEmployee(input);
    setSaving(false);
    if (!res.ok) return setError(res.error ?? t("salaryEmployeeFormDialog.operationFailed"));
    toast(
      isEdit
        ? t("salaryEmployeeFormDialog.employeeUpdated")
        : t("salaryEmployeeFormDialog.employeeRegistered"),
      "success",
    );
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("salaryEmployeeFormDialog.editEmployee") : t("salaryEmployeeFormDialog.addEmployee")}
      description={t("salaryEmployeeFormDialog.registerStaffDescription")}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("academicsClassFormDialog.cancel")}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {isEdit ? t("salaryEmployeeFormDialog.saveChanges") : t("salaryEmployeeFormDialog.registerEmployee")}
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
          <Label required>{t("salaryEmployeeFormDialog.fullName")}</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label required>{t("salaryEmployeeFormDialog.position")}</Label>
          <Input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder={t("salaryEmployeeFormDialog.positionPlaceholder")}
            list="employee-position-suggestions"
          />
          <datalist id="employee-position-suggestions">
            {SUGGESTED_POSITIONS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <Label>{t("salaryEmployeeFormDialog.phone")}</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>{t("salaryEmployeeFormDialog.monthlySalary")}</Label>
          <Input
            type="number"
            min={0}
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
        </div>
        <div>
          <Label required>{t("academicsClassFormDialog.status")}</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as EmploymentStatus)}>
            <option value="ACTIVE">{t("academicsClassFormDialog.active")}</option>
            <option value="INACTIVE">{t("academicsClassFormDialog.inactive")}</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>{t("academicsClassFormDialog.notes")}</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}
