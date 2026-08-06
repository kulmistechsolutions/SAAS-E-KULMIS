"use client";

import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createAttendanceShift,
  deleteAttendanceShift,
  listAttendanceShifts,
  updateAttendanceShift,
} from "@/lib/attendance/store";
import type { ApiShift } from "@/lib/attendance/api";
import { toast } from "@/lib/toast";

interface ShiftFormState {
  name: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FORM: ShiftFormState = { name: "", startTime: "", endTime: "" };

export default function AttendanceShiftsPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [shifts, setShifts] = useState<ApiShift[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<ApiShift | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ShiftFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<ApiShift | null>(null);
  const [removing, setRemoving] = useState(false);

  const refresh = () => {
    setLoading(true);
    return listAttendanceShifts()
      .then(setShifts)
      .finally(() => setLoading(false));
  };

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted) void refresh();
  }, [mounted]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(shift: ApiShift) {
    setEditing(shift);
    setForm({
      name: shift.name,
      startTime: shift.startTime ?? "",
      endTime: shift.endTime ?? "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    const name = form.name.trim();
    if (!name) return toast(t("attendanceShifts.nameRequired"), "error");
    setSaving(true);
    const body = {
      name,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
    };
    const res = editing
      ? await updateAttendanceShift(editing.id, body)
      : await createAttendanceShift(body);
    setSaving(false);
    if (!res.ok) return toast(res.error ?? t("attendanceShifts.saveFailed"), "error");
    toast(editing ? t("attendanceShifts.shiftUpdated") : t("attendanceShifts.shiftCreated"), "success");
    setFormOpen(false);
    void refresh();
  }

  async function handleDelete() {
    if (!deleting) return;
    setRemoving(true);
    const res = await deleteAttendanceShift(deleting.id);
    setRemoving(false);
    if (!res.ok) return toast(res.error ?? t("attendanceShifts.removeFailed"), "error");
    toast(t("attendanceShifts.shiftRemoved"), "success");
    setDeleting(null);
    void refresh();
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("attendanceStudents.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/attendance/students"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("attendanceStudents.backToAttendance")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("attendanceShifts.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("attendanceShifts.description")}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" /> {t("attendanceShifts.addShift")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            {t("attendanceStudents.loading")}
          </div>
        ) : shifts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Clock className="h-7 w-7" />
            </span>
            <div>
              <p className="font-medium">{t("attendanceShifts.noShiftsYet")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("attendanceShifts.noShiftsHint")}
              </p>
            </div>
            <Button onClick={openCreate} className="mt-2">
              <Plus className="me-2 h-4 w-4" /> {t("attendanceShifts.addShift")}
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-start text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("attendanceShifts.name")}</th>
                <th className="px-4 py-2.5 font-medium">{t("attendanceShifts.time")}</th>
                <th className="px-4 py-2.5 font-medium">{t("attendanceStudents.status")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.startTime && s.endTime
                      ? `${s.startTime} – ${s.endTime}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="success">{t("attendanceShifts.active")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(s)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("attendanceShifts.editShift") : t("attendanceShifts.addShift")}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t("feesReversePaymentDialog.cancel")}
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? t("attendanceShifts.saving") : t("attendanceShifts.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("attendanceShifts.name")} *
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("attendanceShifts.namePlaceholder")}
              maxLength={60}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("attendanceShifts.startTime")}
              </label>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("attendanceShifts.endTime")}
              </label>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("attendanceShifts.timeHint")}</p>
        </div>
      </Dialog>

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t("attendanceShifts.removeShift")}
        className="max-w-sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={removing}>
              {t("feesReversePaymentDialog.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={removing}>
              {removing ? t("attendanceShifts.removing") : t("attendanceShifts.remove")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t("attendanceShifts.removeConfirm", { name: deleting?.name ?? "" })}
        </p>
      </Dialog>
    </div>
  );
}
