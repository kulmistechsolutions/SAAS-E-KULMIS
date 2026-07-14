"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import {
  classByName,
  ensureAcademicsLoaded,
  getAcademicsState,
  sectionsForClass,
} from "@/lib/academics/store";
import { getState as getStudentsState } from "@/lib/students/store";
import { getTeachersState } from "@/lib/teachers/store";
import {
  apiMarkStudentAttendance,
  apiMarkTeacherAttendance,
  apiStudentDashboard,
  apiStudentRoster,
  apiTeacherDashboard,
  apiTeacherRoster,
  mapTeacherStatusFromApi,
  mapTeacherStatusToApi,
} from "./api";
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

const EMPTY: AttendanceState = {
  studentRecords: [],
  teacherRecords: [],
  defaultStudentStatus: "PRESENT",
};

let state: AttendanceState = EMPTY;
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getAttendanceState(): AttendanceState {
  return state;
}

export function useAttendanceState(): AttendanceState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

function resolveClassId(
  className: string,
  academicYear: string,
): { classId?: string; error?: string } {
  const cls = classByName(className, academicYear);
  if (!cls) {
    return {
      error: `Class "${className}" was not found. Create it under Academics first.`,
    };
  }
  return { classId: cls.id };
}

function resolveSectionId(
  classId: string,
  sectionName: string | null | undefined,
): { sectionId: string | null; error?: string } {
  if (!sectionName) return { sectionId: null };
  const sec = getAcademicsState().sections.find(
    (s) => s.classId === classId && s.name === sectionName,
  );
  if (!sec) {
    return {
      sectionId: null,
      error: `Section "${sectionName}" was not found.`,
    };
  }
  return { sectionId: sec.id };
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

function summarizeStudent(
  records: { status: StudentAttendanceStatus }[],
): AttendanceSummary {
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
    out.total === 0
      ? 0
      : Math.round(((out.present + out.late) / out.total) * 1000) / 10;
  return out;
}

function summarizeTeacher(
  records: { status: TeacherAttendanceStatus }[],
): AttendanceSummary {
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
    out.total === 0
      ? 0
      : Math.round(((out.present + out.late) / out.total) * 1000) / 10;
  return out;
}

// ---------------------------------------------------------------------------
// Student attendance
// ---------------------------------------------------------------------------

export async function loadStudentMarkingRows(
  academicYear: string,
  className: string,
  section: string,
  date: string,
): Promise<{ rows: StudentMarkRow[]; error?: string }> {
  await ensureAcademicsLoaded();
  const { classId, error: classErr } = resolveClassId(className, academicYear);
  if (classErr || !classId) return { rows: [], error: classErr };

  const { sectionId, error: secErr } = resolveSectionId(classId, section);
  if (secErr) return { rows: [], error: secErr };

  try {
    const res = await apiStudentRoster(classId, date, sectionId);
    const rows = res.roster
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((s) => ({
        studentId: s.id,
        code: s.code,
        fullName: s.fullName,
        gender: "MALE" as const,
        status: s.status ?? state.defaultStudentStatus,
        eligible: true,
      }));

    return { rows };
  } catch (e) {
    return { rows: [], error: apiErr(e, "Failed to load student roster.") };
  }
}

export async function saveStudentAttendance(
  academicYear: string,
  className: string,
  section: string,
  date: string,
  rows: { studentId: string; status: StudentAttendanceStatus }[],
): Promise<SaveStudentResult> {
  if (!className) return { ok: false, error: "Class is required." };
  if (!section) return { ok: false, error: "Section is required for this class." };

  await ensureAcademicsLoaded();
  const { classId, error: classErr } = resolveClassId(className, academicYear);
  if (classErr || !classId) return { ok: false, error: classErr };

  const { sectionId, error: secErr } = resolveSectionId(classId, section);
  if (secErr) return { ok: false, error: secErr };

  const mark = await loadStudentMarkingRows(academicYear, className, section, date);
  if (mark.error) return { ok: false, error: mark.error };

  const eligibleIds = new Set(
    mark.rows.filter((r) => r.eligible).map((r) => r.studentId),
  );
  for (const row of rows) {
    if (!eligibleIds.has(row.studentId)) {
      return {
        ok: false,
        error: "Cannot mark attendance for inactive or graduated students.",
      };
    }
  }

  try {
    await apiMarkStudentAttendance({
      classId,
      sectionId,
      date,
      records: rows,
    });
    notify();
    return { ok: true, summary: summarizeStudent(rows) };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to save attendance.") };
  }
}

export async function studentDashboardToday(
  date = todayISO(),
  classId?: string,
  sectionId?: string,
): Promise<AttendanceSummary & { totalStudents: number }> {
  try {
    const dash = await apiStudentDashboard(date, classId, sectionId);
    return {
      total: dash.total,
      present: dash.PRESENT,
      absent: dash.ABSENT,
      late: dash.LATE,
      excused: dash.EXCUSED,
      percentage: dash.presentPercentage,
      totalStudents: dash.total,
    };
  } catch {
    return {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      percentage: 0,
      totalStudents: 0,
    };
  }
}

async function fetchStudentRecordsForDate(
  date: string,
  academicYear: string,
  className?: string,
  section?: string,
): Promise<StudentAttendanceRecord[]> {
  const a = getAcademicsState();
  const st = getStudentsState();
  const smap = new Map(st.students.map((s) => [s.id, s]));

  let pairs: { className: string; section: string; classId: string; sectionId: string }[] = [];

  if (className) {
    const { classId, error } = resolveClassId(className, academicYear);
    if (error || !classId) return [];
    if (section) {
      const { sectionId, error: secErr } = resolveSectionId(classId, section);
      if (secErr || !sectionId) return [];
      pairs = [{ className, section, classId, sectionId }];
    } else {
      pairs = sectionsForClass(classId).map((sec) => ({
        className,
        section: sec.name,
        classId,
        sectionId: sec.id,
      }));
    }
  } else {
    pairs = a.classes
      .filter((c) => c.academicYear === academicYear)
      .flatMap((cls) =>
        sectionsForClass(cls.id).map((sec) => ({
          className: cls.name,
          section: sec.name,
          classId: cls.id,
          sectionId: sec.id,
        })),
      );
  }

  const records: StudentAttendanceRecord[] = [];
  const now = new Date().toISOString();

  for (const pair of pairs) {
    try {
      const res = await apiStudentRoster(pair.classId, date, pair.sectionId);
      for (const row of res.roster) {
        if (!row.status) continue;
        const student = smap.get(row.id);
        if (!student) continue;
        records.push({
          id: `${row.id}_${date}`,
          studentId: row.id,
          academicYear,
          className: pair.className,
          section: pair.section,
          date,
          status: row.status,
          markedAt: now,
        });
      }
    } catch {
      /* skip failed section */
    }
  }

  return records;
}

export async function filterStudentRecords(opts: {
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
  const year = opts.academicYear ?? "";
  const date = opts.date ?? todayISO();

  const all = await fetchStudentRecordsForDate(
    date,
    year,
    opts.className,
    opts.section,
  );

  return all
    .filter((r) => {
      const s = smap.get(r.studentId);
      if (!s) return false;
      if (opts.academicYear && r.academicYear !== opts.academicYear) return false;
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

export async function studentHistory(studentId: string) {
  const st = getStudentsState();
  const student = st.students.find((s) => s.id === studentId);
  if (!student) return { records: [], summary: summarizeStudent([]) };

  const records: StudentAttendanceRecord[] = [];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const dayRecords = await fetchStudentRecordsForDate(
      date,
      student.academicYear,
      student.className,
      student.section ?? undefined,
    );
    records.push(...dayRecords.filter((r) => r.studentId === studentId));
  }

  records.sort((a, b) => b.date.localeCompare(a.date));
  return { records, summary: summarizeStudent(records) };
}

// ---------------------------------------------------------------------------
// Teacher attendance
// ---------------------------------------------------------------------------

export async function loadTeacherMarkingRows(
  _academicYear: string,
  shift: "MORNING" | "AFTERNOON",
  date: string,
): Promise<{ rows: TeacherMarkRow[]; error?: string }> {
  try {
    const res = await apiTeacherRoster(shift, date);
    const statusById = new Map(
      res.roster.map((r) => [
        r.id,
        r.status ? mapTeacherStatusFromApi(r.status) : ("PRESENT" as const),
      ]),
    );

    const tt = getTeachersState();
    const rows = tt.teachers
      .filter((t) => t.shift === shift)
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((t) => {
        const eligible = t.status === "ACTIVE";
        return {
          teacherId: t.id,
          code: t.code,
          fullName: t.fullName,
          shift: t.shift,
          status: statusById.get(t.id) ?? "PRESENT",
          eligible,
          reason: !eligible ? "Inactive" : undefined,
        };
      });

    return { rows };
  } catch (e) {
    return { rows: [], error: apiErr(e, "Failed to load teacher roster.") };
  }
}

export async function saveTeacherAttendance(
  _academicYear: string,
  shift: "MORNING" | "AFTERNOON",
  date: string,
  rows: { teacherId: string; status: TeacherAttendanceStatus }[],
): Promise<SaveStudentResult> {
  const mark = await loadTeacherMarkingRows("", shift, date);
  if (mark.error) return { ok: false, error: mark.error };

  const eligibleIds = new Set(
    mark.rows.filter((r) => r.eligible).map((r) => r.teacherId),
  );
  for (const row of rows) {
    if (!eligibleIds.has(row.teacherId)) {
      return { ok: false, error: "Cannot mark attendance for inactive teachers." };
    }
  }

  try {
    await apiMarkTeacherAttendance({
      shift,
      date,
      records: rows.map((r) => ({
        teacherId: r.teacherId,
        status: mapTeacherStatusToApi(r.status),
      })),
    });
    notify();
    return { ok: true, summary: summarizeTeacher(rows) };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to save attendance.") };
  }
}

export async function teacherDashboardToday(date = todayISO()) {
  const tt = getTeachersState();
  const active = tt.teachers.filter((t) => t.status === "ACTIVE").length;
  const morning = tt.teachers.filter(
    (t) => t.shift === "MORNING" && t.status === "ACTIVE",
  ).length;
  const afternoon = tt.teachers.filter(
    (t) => t.shift === "AFTERNOON" && t.status === "ACTIVE",
  ).length;

  try {
    const dash = await apiTeacherDashboard(date);
    return {
      total: dash.total,
      present: dash.PRESENT,
      absent: dash.ABSENT,
      late: dash.LATE,
      excused: 0,
      leave: dash.EXCUSED,
      percentage: dash.attendanceRate,
      totalTeachers: active,
      morning,
      afternoon,
    };
  } catch {
    return {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      leave: 0,
      percentage: 0,
      totalTeachers: active,
      morning,
      afternoon,
    };
  }
}

async function fetchTeacherRecordsForDate(
  date: string,
  shift?: "MORNING" | "AFTERNOON",
): Promise<TeacherAttendanceRecord[]> {
  const tt = getTeachersState();
  const tmap = new Map(tt.teachers.map((t) => [t.id, t]));
  const shifts: ("MORNING" | "AFTERNOON")[] = shift ? [shift] : ["MORNING", "AFTERNOON"];
  const records: TeacherAttendanceRecord[] = [];
  const now = new Date().toISOString();
  const year =
    getAcademicsState().academicYears.find((y) => y.status === "ACTIVE")?.name ?? "";

  for (const s of shifts) {
    try {
      const res = await apiTeacherRoster(s, date);
      for (const row of res.roster) {
        if (!row.status) continue;
        const teacher = tmap.get(row.id);
        if (!teacher) continue;
        records.push({
          id: `${row.id}_${date}`,
          teacherId: row.id,
          academicYear: year,
          shift: s,
          date,
          status: mapTeacherStatusFromApi(row.status),
          markedAt: now,
        });
      }
    } catch {
      /* skip failed shift */
    }
  }

  return records;
}

export async function filterTeacherRecords(opts: {
  academicYear?: string;
  date?: string;
  shift?: "MORNING" | "AFTERNOON";
  status?: TeacherAttendanceStatus;
  search?: string;
}) {
  const tt = getTeachersState();
  const tmap = new Map(tt.teachers.map((t) => [t.id, t]));
  const q = opts.search?.trim().toLowerCase() ?? "";
  const date = opts.date ?? todayISO();

  const all = await fetchTeacherRecordsForDate(date, opts.shift);

  return all
    .filter((r) => {
      const t = tmap.get(r.teacherId);
      if (!t) return false;
      if (opts.academicYear && r.academicYear !== opts.academicYear) return false;
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
