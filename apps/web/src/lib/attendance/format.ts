import type { StudentAttendanceStatus, TeacherAttendanceStatus } from "./types";

export const STUDENT_STATUSES: StudentAttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
];

export const TEACHER_STATUSES: TeacherAttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "LEAVE",
];

const STUDENT_LABELS: Record<StudentAttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

const TEACHER_LABELS: Record<TeacherAttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  LEAVE: "Leave",
};

export const studentStatusLabel = (s: StudentAttendanceStatus) => STUDENT_LABELS[s];
export const teacherStatusLabel = (s: TeacherAttendanceStatus) => TEACHER_LABELS[s];

export const STUDENT_STATUS_STYLE: Record<
  StudentAttendanceStatus,
  string
> = {
  PRESENT: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  ABSENT: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-400",
  LATE: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  EXCUSED: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-400",
};

export const TEACHER_STATUS_STYLE: Record<
  TeacherAttendanceStatus,
  string
> = {
  PRESENT: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  ABSENT: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-400",
  LATE: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  LEAVE: "bg-violet-500/15 text-violet-700 border-violet-500/30 dark:text-violet-400",
};

export function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function formatDisplayDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
