"use client";

import { useSyncExternalStore } from "react";
import { ACTIVE_ACADEMIC_YEAR, CLASSES, SECTIONS } from "@/lib/students/constants";
import { getState as getStudentsState } from "@/lib/students/store";
import { getTeachersState } from "@/lib/teachers/store";
import { todayISO } from "./format";
import type {
  AttendanceState,
  StudentAttendanceRecord,
  StudentAttendanceStatus,
  StudentMarkRow,
  TeacherAttendanceRecord,
  TeacherAttendanceStatus,
  TeacherMarkRow,
} from "./types";

const KEY = "ekulmis_attendance_v1";

const EMPTY: AttendanceState = {
  studentRecords: [],
  teacherRecords: [],
  defaultStudentStatus: "PRESENT",
};

let state: AttendanceState | null = null;
const listeners = new Set<() => void>();

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function buildSeed(): AttendanceState {
  const st = getStudentsState();
  const tt = getTeachersState();
  const studentRecords: StudentAttendanceRecord[] = [];
  const teacherRecords: TeacherAttendanceRecord[] = [];
  const today = new Date();
  let sid = 0;
  let tid = 0;

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - dayOffset);
    const date = d.toISOString().slice(0, 10);
    const rand = rng(dayOffset * 17 + 3);

    for (const className of CLASSES.slice(0, 8)) {
      for (const section of SECTIONS) {
        const students = st.students
          .filter(
            (s) =>
              s.status === "ACTIVE" &&
              s.className === className &&
              (s.section ?? "") === section,
          )
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
        if (students.length === 0) continue;
        students.forEach((s, i) => {
          sid += 1;
          const r = rand();
          const status: StudentAttendanceStatus =
            r > 0.88 ? "ABSENT" : r > 0.8 ? "LATE" : r > 0.76 ? "EXCUSED" : "PRESENT";
          studentRecords.push({
            id: `sa_${sid}`,
            studentId: s.id,
            academicYear: ACTIVE_ACADEMIC_YEAR,
            className,
            section,
            date,
            status,
            markedAt: d.toISOString(),
          });
        });
      }
    }

    for (const shift of ["MORNING", "AFTERNOON"] as const) {
      const teachers = tt.teachers.filter(
        (t) => t.status === "ACTIVE" && t.shift === shift,
      );
      teachers.forEach((t) => {
        tid += 1;
        const r = rand();
        const status: TeacherAttendanceStatus =
          r > 0.92 ? "ABSENT" : r > 0.86 ? "LATE" : r > 0.82 ? "LEAVE" : "PRESENT";
        teacherRecords.push({
          id: `ta_${tid}`,
          teacherId: t.id,
          academicYear: ACTIVE_ACADEMIC_YEAR,
          shift,
          date,
          status,
          markedAt: d.toISOString(),
        });
      });
    }
  }

  return { studentRecords, teacherRecords, defaultStudentStatus: "PRESENT" };
}

function load(): AttendanceState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AttendanceState;
  } catch {
    /* ignore */
  }
  const seed = buildSeed();
  try {
    localStorage.setItem(KEY, JSON.stringify(seed));
  } catch {
    /* ignore */
  }
  return seed;
}

function ensure(): AttendanceState {
  if (!state) state = load();
  return state;
}

function setState(next: AttendanceState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getAttendanceState(): AttendanceState {
  return ensure();
}

export function useAttendanceState(): AttendanceState {
  return useSyncExternalStore(subscribe, getAttendanceState, () => EMPTY);
}

// ---------------------------------------------------------------------------
// Student attendance
// ---------------------------------------------------------------------------

export function loadStudentMarkingRows(
  academicYear: string,
  className: string,
  section: string,
  date: string,
): StudentMarkRow[] {
  const st = getStudentsState();
  const att = ensure();
  const existing = new Map(
    att.studentRecords
      .filter(
        (r) =>
          r.date === date &&
          r.className === className &&
          (r.section ?? "") === section &&
          r.academicYear === academicYear,
      )
      .map((r) => [r.studentId, r.status]),
  );

  return st.students
    .filter((s) => s.className === className && (s.section ?? "") === section)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((s) => {
      const eligible = s.status === "ACTIVE";
      return {
        studentId: s.id,
        code: s.code,
        fullName: s.fullName,
        gender: s.gender,
        status: existing.get(s.id) ?? att.defaultStudentStatus,
        eligible,
        reason: !eligible
          ? s.status === "GRADUATED"
            ? "Graduated"
            : "Inactive"
          : undefined,
      };
    });
}

export interface SaveStudentResult {
  ok: boolean;
  error?: string;
  summary?: AttendanceSummary;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  leave?: number;
  percentage: number;
}

function summarizeStudent(records: { status: StudentAttendanceStatus }[]): AttendanceSummary {
  const out: AttendanceSummary = {
    total: records.length,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    percentage: 0,
  };
  for (const r of records) {
    if (r.status === "PRESENT") out.present++;
    else if (r.status === "ABSENT") out.absent++;
    else if (r.status === "LATE") out.late++;
    else if (r.status === "EXCUSED") out.excused++;
  }
  out.percentage =
    out.total === 0 ? 0 : Math.round((out.present / out.total) * 1000) / 10;
  return out;
}

export function saveStudentAttendance(
  academicYear: string,
  className: string,
  section: string,
  date: string,
  rows: { studentId: string; status: StudentAttendanceStatus }[],
): SaveStudentResult {
  if (!className) return { ok: false, error: "Class is required." };
  if (!section) return { ok: false, error: "Section is required for this class." };

  const markRows = loadStudentMarkingRows(academicYear, className, section, date);
  const eligibleIds = new Set(markRows.filter((r) => r.eligible).map((r) => r.studentId));

  for (const row of rows) {
    if (!eligibleIds.has(row.studentId)) {
      return { ok: false, error: "Cannot mark attendance for inactive or graduated students." };
    }
  }

  const att = ensure();
  const other = att.studentRecords.filter(
    (r) =>
      !(
        r.date === date &&
        r.className === className &&
        (r.section ?? "") === section &&
        r.academicYear === academicYear
      ),
  );

  const now = new Date().toISOString();
  const newRecords: StudentAttendanceRecord[] = rows.map((row, i) => ({
    id: `sa_${Date.now()}_${i}`,
    studentId: row.studentId,
    academicYear,
    className,
    section,
    date,
    status: row.status,
    markedAt: now,
  }));

  setState({ ...att, studentRecords: [...other, ...newRecords] });
  return { ok: true, summary: summarizeStudent(newRecords) };
}

export function studentDashboardToday(date = todayISO()): AttendanceSummary & {
  totalStudents: number;
} {
  const st = getStudentsState();
  const active = st.students.filter((s) => s.status === "ACTIVE").length;
  const records = ensure().studentRecords.filter((r) => r.date === date);
  const sum = summarizeStudent(records);
  return { ...sum, totalStudents: active };
}

export function filterStudentRecords(opts: {
  academicYear?: string;
  date?: string;
  className?: string;
  section?: string;
  status?: StudentAttendanceStatus;
  search?: string;
}) {
  const st = getStudentsState();
  const smap = new Map(st.students.map((s) => [s.id, s]));
  const q = opts.search?.trim().toLowerCase() ?? "";

  return ensure()
    .studentRecords.filter((r) => {
      const s = smap.get(r.studentId);
      if (!s) return false;
      if (opts.academicYear && r.academicYear !== opts.academicYear) return false;
      if (opts.date && r.date !== opts.date) return false;
      if (opts.className && r.className !== opts.className) return false;
      if (opts.section && (r.section ?? "") !== opts.section) return false;
      if (opts.status && r.status !== opts.status) return false;
      if (q) {
        const hay = `${s.code} ${s.fullName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((r) => ({ ...r, student: smap.get(r.studentId)! }))
    .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName));
}

export function studentHistory(studentId: string) {
  const records = ensure()
    .studentRecords.filter((r) => r.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const sum = summarizeStudent(records);
  return { records, summary: sum };
}

// ---------------------------------------------------------------------------
// Teacher attendance
// ---------------------------------------------------------------------------

export function loadTeacherMarkingRows(
  academicYear: string,
  shift: "MORNING" | "AFTERNOON",
  date: string,
): TeacherMarkRow[] {
  const tt = getTeachersState();
  const att = ensure();
  const existing = new Map(
    att.teacherRecords
      .filter(
        (r) => r.date === date && r.shift === shift && r.academicYear === academicYear,
      )
      .map((r) => [r.teacherId, r.status]),
  );

  return tt.teachers
    .filter((t) => t.shift === shift)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((t) => {
      const eligible = t.status === "ACTIVE";
      return {
        teacherId: t.id,
        code: t.code,
        fullName: t.fullName,
        shift: t.shift,
        status: existing.get(t.id) ?? "PRESENT",
        eligible,
        reason: !eligible ? "Inactive" : undefined,
      };
    });
}

export function saveTeacherAttendance(
  academicYear: string,
  shift: "MORNING" | "AFTERNOON",
  date: string,
  rows: { teacherId: string; status: TeacherAttendanceStatus }[],
): SaveStudentResult {
  const markRows = loadTeacherMarkingRows(academicYear, shift, date);
  const eligibleIds = new Set(markRows.filter((r) => r.eligible).map((r) => r.teacherId));

  for (const row of rows) {
    if (!eligibleIds.has(row.teacherId)) {
      return { ok: false, error: "Cannot mark attendance for inactive teachers." };
    }
  }

  const att = ensure();
  const other = att.teacherRecords.filter(
    (r) => !(r.date === date && r.shift === shift && r.academicYear === academicYear),
  );

  const now = new Date().toISOString();
  const newRecords: TeacherAttendanceRecord[] = rows.map((row, i) => ({
    id: `ta_${Date.now()}_${i}`,
    teacherId: row.teacherId,
    academicYear,
    shift,
    date,
    status: row.status,
    markedAt: now,
  }));

  setState({ ...att, teacherRecords: [...other, ...newRecords] });
  const sum = summarizeTeacher(newRecords);
  return { ok: true, summary: sum };
}

function summarizeTeacher(records: { status: TeacherAttendanceStatus }[]): AttendanceSummary {
  const out: AttendanceSummary = {
    total: records.length,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    leave: 0,
    percentage: 0,
  };
  for (const r of records) {
    if (r.status === "PRESENT") out.present++;
    else if (r.status === "ABSENT") out.absent++;
    else if (r.status === "LATE") out.late++;
    else if (r.status === "LEAVE") out.leave!++;
  }
  out.percentage =
    out.total === 0 ? 0 : Math.round((out.present / out.total) * 1000) / 10;
  return out;
}

export function teacherDashboardToday(date = todayISO()) {
  const tt = getTeachersState();
  const active = tt.teachers.filter((t) => t.status === "ACTIVE").length;
  const morning = tt.teachers.filter((t) => t.shift === "MORNING" && t.status === "ACTIVE").length;
  const afternoon = tt.teachers.filter((t) => t.shift === "AFTERNOON" && t.status === "ACTIVE").length;
  const records = ensure().teacherRecords.filter((r) => r.date === date);
  const sum = summarizeTeacher(records);
  return { ...sum, totalTeachers: active, morning, afternoon };
}

export function filterTeacherRecords(opts: {
  academicYear?: string;
  date?: string;
  shift?: "MORNING" | "AFTERNOON";
  status?: TeacherAttendanceStatus;
  search?: string;
}) {
  const tt = getTeachersState();
  const tmap = new Map(tt.teachers.map((t) => [t.id, t]));
  const q = opts.search?.trim().toLowerCase() ?? "";

  return ensure()
    .teacherRecords.filter((r) => {
      const t = tmap.get(r.teacherId);
      if (!t) return false;
      if (opts.academicYear && r.academicYear !== opts.academicYear) return false;
      if (opts.date && r.date !== opts.date) return false;
      if (opts.shift && r.shift !== opts.shift) return false;
      if (opts.status && r.status !== opts.status) return false;
      if (q) {
        const hay = `${t.code} ${t.fullName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((r) => ({ ...r, teacher: tmap.get(r.teacherId)! }))
    .sort((a, b) => a.teacher.fullName.localeCompare(b.teacher.fullName));
}

export function resetAttendance() {
  setState(buildSeed());
}
