"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import {
  apiAttendanceShiftUsage,
  type ApiShift,
  type ApiShiftUsage,
} from "@/lib/attendance/api";
import { deleteAttendanceShift } from "@/lib/attendance/store";

/**
 * Retire a shift, or delete it — with what is riding on it in front of you.
 *
 * The button used to say "Removed" and then leave the shift sitting in the
 * list for ever, because the only thing it did was set the status. Retiring is
 * still the right default and still the safe one, but a school that created
 * "Morning" twice by mistake needs the other answer too.
 *
 * So both are offered, and the counts come first. A shift holding two years of
 * registers and one created this morning look identical in the list, and the
 * difference is the whole decision.
 *
 * Deleting keeps the attendance. Every register's shift is `onDelete:
 * SetNull`, so the marks survive with the shift unset, and the marking screen
 * already falls back to the unshifted register for that day. What goes is the
 * statements about the shift — which teachers worked it, which officers held
 * it — because they describe a session that no longer exists.
 */
export function ShiftDeleteDialog({
  shift,
  onClose,
  onDone,
}: {
  shift: ApiShift | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [usage, setUsage] = useState<ApiShiftUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!shift) {
      setUsage(null);
      setConfirmed(false);
      return;
    }
    let live = true;
    setLoading(true);
    setUsage(null);
    setConfirmed(false);
    apiAttendanceShiftUsage(shift.id)
      .then((u) => {
        if (live) setUsage(u);
      })
      .catch(() => {
        // A usage we cannot read is not a reason to block retiring, but it is
        // a reason not to offer a permanent delete on no information.
        if (live) setUsage(null);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [shift]);

  async function run(hard: boolean) {
    if (!shift) return;
    setBusy(true);
    const res = await deleteAttendanceShift(shift.id, hard);
    setBusy(false);
    if (!res.ok) {
      return toast(res.error ?? t("attendanceShifts.removeFailed"), "error");
    }
    toast(
      hard
        ? t("attendanceShifts.deletedForGood")
        : t("attendanceShifts.shiftRemoved"),
      "success",
    );
    onClose();
    onDone();
  }

  const records =
    usage
      ? usage.studentAttendance +
        usage.teacherAttendance +
        usage.teacherAssignments +
        usage.teachers +
        usage.officerGrants
      : 0;
  const canDelete = usage !== null && !loading;

  return (
    <Dialog
      open={!!shift}
      onClose={onClose}
      title={t("attendanceShifts.removeShift")}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("feesReversePaymentDialog.cancel")}
          </Button>
          {shift?.status === "ACTIVE" && (
            <Button
              variant="outline"
              onClick={() => void run(false)}
              disabled={busy}
            >
              {busy ? t("attendanceShifts.removing") : t("attendanceShifts.retire")}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => void run(true)}
            disabled={busy || !canDelete || (records > 0 && !confirmed)}
          >
            {busy ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="me-2 h-4 w-4" />
            )}
            {t("attendanceShifts.deletePermanently")}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="font-medium">{shift?.name}</p>

        {loading ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("attendanceShifts.checkingUsage")}
          </p>
        ) : records === 0 ? (
          <p className="text-muted-foreground">
            {t("attendanceShifts.nothingAttached")}
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="flex items-start gap-2 font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t("attendanceShifts.usageTitle").replace("{n}", String(records))}
            </p>
            <ul className="space-y-0.5 ps-6 text-amber-800/90 dark:text-amber-300/90">
              {usage!.studentAttendance > 0 && (
                <li>
                  {t("attendanceShifts.usageStudents").replace(
                    "{n}",
                    String(usage!.studentAttendance),
                  )}
                  {usage!.firstDate && usage!.lastDate
                    ? ` (${usage!.firstDate} – ${usage!.lastDate})`
                    : ""}
                </li>
              )}
              {usage!.teacherAttendance > 0 && (
                <li>
                  {t("attendanceShifts.usageTeacherDays").replace(
                    "{n}",
                    String(usage!.teacherAttendance),
                  )}
                </li>
              )}
              {usage!.teachers > 0 && (
                <li>
                  {t("attendanceShifts.usageTeachers").replace(
                    "{n}",
                    String(usage!.teachers),
                  )}
                </li>
              )}
              {usage!.teacherAssignments > 0 && (
                <li>
                  {t("attendanceShifts.usageAssignments").replace(
                    "{n}",
                    String(usage!.teacherAssignments),
                  )}
                </li>
              )}
              {usage!.officerGrants > 0 && (
                <li>
                  {t("attendanceShifts.usageOfficers").replace(
                    "{n}",
                    String(usage!.officerGrants),
                  )}
                </li>
              )}
            </ul>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
              {t("attendanceShifts.usageKept")}
            </p>
            <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs font-medium">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-rose-600"
              />
              {t("attendanceShifts.usageConfirm").replace(
                "{name}",
                shift?.name ?? "",
              )}
            </label>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {shift?.status === "ACTIVE"
            ? t("attendanceShifts.retireHint")
            : t("attendanceShifts.alreadyRetired")}
        </p>
      </div>
    </Dialog>
  );
}
