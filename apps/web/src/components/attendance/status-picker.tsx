"use client";

import { cn } from "@/lib/utils";
import {
  STUDENT_STATUSES,
  STUDENT_STATUS_STYLE,
  studentStatusLabel,
  TEACHER_STATUSES,
  TEACHER_STATUS_STYLE,
  teacherStatusLabel,
} from "@/lib/attendance/format";
import type { StudentAttendanceStatus, TeacherAttendanceStatus } from "@/lib/attendance/types";

export function StudentStatusPicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: StudentAttendanceStatus;
  onChange: (s: StudentAttendanceStatus) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", compact && "gap-1")}>
      {STUDENT_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          className={cn(
            "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
            compact ? "px-2 py-0.5" : "px-3 py-1.5 text-sm",
            value === s
              ? cn(STUDENT_STATUS_STYLE[s], "ring-2 ring-primary/30")
              : "border-input bg-background text-muted-foreground hover:bg-secondary",
            disabled && "pointer-events-none opacity-40",
          )}
        >
          {studentStatusLabel(s)}
        </button>
      ))}
    </div>
  );
}

export function TeacherStatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: TeacherAttendanceStatus;
  onChange: (s: TeacherAttendanceStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TEACHER_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
            value === s
              ? cn(TEACHER_STATUS_STYLE[s], "ring-2 ring-primary/30")
              : "border-input bg-background text-muted-foreground hover:bg-secondary",
            disabled && "pointer-events-none opacity-40",
          )}
        >
          {teacherStatusLabel(s)}
        </button>
      ))}
    </div>
  );
}
