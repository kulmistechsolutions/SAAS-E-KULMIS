"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  apiClassPurgePreview,
  apiPurgeClass,
  type ApiClassPurgePreview,
} from "@/lib/academics/api";
import { toast } from "@/lib/toast";

interface Props {
  open: boolean;
  classId: string | null;
  className: string;
  onClose: () => void;
  /** Called after a successful purge so the caller can refresh its list. */
  onPurged: () => void;
}

/**
 * Erasing a class is not undoable, so this dialog does three things before it
 * lets the admin through: it says plainly what "erase" means, it shows the
 * real counts pulled from the server, and it makes them type the class name.
 */
export function ClassPurgeDialog({
  open,
  classId,
  className,
  onClose,
  onPurged,
}: Props) {
  const [preview, setPreview] = useState<ApiClassPurgePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open || !classId) {
      setPreview(null);
      setTyped("");
      return;
    }
    setLoading(true);
    let active = true;
    void apiClassPurgePreview(classId)
      .then((res) => {
        if (active) setPreview(res);
      })
      .catch((err: unknown) => {
        if (!active) return;
        toast(err instanceof Error ? err.message : "Could not load", "error");
        onClose();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, classId, onClose]);

  const confirmed = typed.trim() === className.trim() && typed.trim() !== "";

  async function handlePurge() {
    if (!classId || !confirmed) return;
    setBusy(true);
    try {
      const res = await apiPurgeClass(classId, typed.trim());
      const freed = res.freedStudentCodes.length;
      toast(
        `${res.className} erased — ${res.studentsDeleted} students, ` +
          `${res.parentsDeleted} parents. ${freed} student ID${
            freed === 1 ? "" : "s"
          } freed for reuse.`,
        "success",
      );
      onPurged();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const c = preview?.counts;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Erase class permanently"
      description="This cannot be undone."
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!confirmed || busy || loading}
            onClick={() => void handlePurge()}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Erasing…
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Erase everything
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-1">
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {className}
              {preview ? ` · ${preview.academicYear}` : ""}
            </p>
            <p className="mt-1">
              Every student in this class is deleted along with their whole
              history — marks, attendance, fees, payments, quizzes and library
              loans. Parents left with no other children lose their account
              too. Their student IDs become free and will be issued again to
              new students.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Counting what would be deleted…
          </div>
        ) : c ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border p-3 text-sm sm:grid-cols-3">
            <Count label="Students" value={c.students} strong />
            <Count label="Parents" value={c.parentsDeleted} strong />
            <Count label="Exam marks" value={c.examMarks} />
            <Count label="Attendance" value={c.attendance} />
            <Count label="Fee charges" value={c.feeCharges} />
            <Count label="Payments" value={c.payments} />
            <Count label="Exams" value={c.exams} />
            <Count label="Sections" value={c.sections} />
            <Count label="Quiz attempts" value={c.quizAttempts} />
            <Count label="Book loans" value={c.bookLoans} />
            <Count label="Timetable slots" value={c.timetableEntries} />
            <Count label="Teacher links" value={c.teacherAssignments} />
          </div>
        ) : null}

        {c && c.parentsKept > 0 ? (
          <p className="text-xs text-muted-foreground">
            {c.parentsKept} parent{c.parentsKept === 1 ? "" : "s"} kept — they
            have children in other classes.
          </p>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium">
            Type <span className="font-mono font-semibold">{className}</span> to
            confirm
          </label>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={className}
            autoComplete="off"
            disabled={busy}
          />
        </div>
      </div>
    </Dialog>
  );
}

function Count({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? "font-bold" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
