"use client";

import { api } from "@/lib/api";
import type { StudentAttendanceStatus, TeacherAttendanceStatus } from "./types";

type ApiAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface ApiStudentRosterItem {
  id: string;
  code: string;
  fullName: string;
  gender: string;
  status: ApiAttendanceStatus | null;
}

export interface ApiStudentRosterResponse {
  date: string;
  roster: ApiStudentRosterItem[];
}

export interface ApiShift {
  id: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  orderIndex: number;
  status: "ACTIVE" | "INACTIVE";
}

export interface ApiStudentDashboardResponse {
  date: string;
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
  total: number;
  presentPercentage: number;
}

export interface ApiTeacherRosterItem {
  id: string;
  code: string;
  fullName: string;
  shifts: string[];
  status: ApiAttendanceStatus | null;
}

export interface ApiTeacherRosterResponse {
  date: string;
  shift: string;
  roster: ApiTeacherRosterItem[];
}

export interface ApiTeacherDashboardResponse {
  date: string;
  shift: string;
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
  total: number;
  attendanceRate: number;
}

export function mapTeacherStatusToApi(
  status: TeacherAttendanceStatus,
): ApiAttendanceStatus {
  return status === "LEAVE" ? "EXCUSED" : status;
}

export function mapTeacherStatusFromApi(
  status: ApiAttendanceStatus,
): TeacherAttendanceStatus {
  return status === "EXCUSED" ? "LEAVE" : status;
}

export async function apiStudentRoster(
  classId: string,
  date: string,
  sectionId?: string | null,
  shiftId?: string | null,
): Promise<ApiStudentRosterResponse> {
  const params = new URLSearchParams({ classId, date });
  if (sectionId) params.set("sectionId", sectionId);
  if (shiftId) params.set("shiftId", shiftId);
  return api<ApiStudentRosterResponse>(`/student-attendance?${params}`);
}

export async function apiMarkStudentAttendance(body: {
  classId: string;
  sectionId?: string | null;
  shiftId?: string | null;
  date: string;
  records: { studentId: string; status: StudentAttendanceStatus }[];
}): Promise<{
  date: string;
  marked: number;
  skipped: number;
  /** Rows that already carried someone else's mark and were replaced. */
  overwritten: number;
  overwrittenFrom: string[];
}> {
  return api("/student-attendance/mark", { method: "POST", body });
}

export async function apiStudentDashboard(
  date: string,
  classId?: string,
  sectionId?: string,
  shiftId?: string,
): Promise<ApiStudentDashboardResponse> {
  const params = new URLSearchParams({ date });
  if (classId) params.set("classId", classId);
  if (sectionId) params.set("sectionId", sectionId);
  if (shiftId) params.set("shiftId", shiftId);
  return api<ApiStudentDashboardResponse>(
    `/student-attendance/dashboard?${params}`,
  );
}

/**
 * Attendance Shift Management — a school's own standalone list of named
 * sessions ("Morning", "Afternoon") used to tag attendance, independent of
 * the timetable module.
 */
export async function apiListAttendanceShifts(): Promise<ApiShift[]> {
  return api<ApiShift[]>("/attendance-shifts");
}

export interface SaveAttendanceShiftBody {
  name: string;
  startTime?: string | null;
  endTime?: string | null;
}

export async function apiCreateAttendanceShift(
  body: SaveAttendanceShiftBody,
): Promise<ApiShift> {
  return api<ApiShift>("/attendance-shifts", { method: "POST", body });
}

export async function apiUpdateAttendanceShift(
  id: string,
  body: SaveAttendanceShiftBody,
): Promise<ApiShift> {
  return api<ApiShift>(`/attendance-shifts/${id}`, { method: "PATCH", body });
}

export async function apiDeleteAttendanceShift(
  id: string,
): Promise<{ success: boolean }> {
  return api(`/attendance-shifts/${id}`, { method: "DELETE" });
}

export interface ApiAttendanceReportRow {
  student: string;
  code: string;
  className: string;
  section: string;
  shift: string;
  date: string;
  status: string;
}

export interface ApiAttendanceReportData {
  columns: { key: string; label: string; mono?: boolean }[];
  rows: ApiAttendanceReportRow[];
  summary: { label: string; value: string }[];
}

/**
 * The Student Attendance page's own Reports tab — computed server-side from
 * StudentAttendance directly (see AttendanceReportsService.daily), not by
 * replaying the roster fetch used for marking attendance.
 */
export async function apiStudentDailyAttendanceReport(filters: {
  academicYear: string;
  date?: string;
  className?: string;
  section?: string;
  status?: string;
  shiftId?: string;
  search?: string;
}): Promise<ApiAttendanceReportData> {
  const params = new URLSearchParams({ academicYear: filters.academicYear });
  for (const key of ["date", "className", "section", "status", "shiftId", "search"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return api<ApiAttendanceReportData>(
    `/reports/attendance-reports/student-daily?${params.toString()}`,
  );
}

export async function apiTeacherRoster(
  shift: string,
  date: string,
): Promise<ApiTeacherRosterResponse> {
  const params = new URLSearchParams({ shift, date });
  return api<ApiTeacherRosterResponse>(`/teacher-attendance?${params}`);
}

export async function apiMarkTeacherAttendance(body: {
  shift: string;
  date: string;
  records: { teacherId: string; status: ApiAttendanceStatus }[];
}): Promise<{ date: string; shift: string; marked: number; skipped: number }> {
  return api("/teacher-attendance/mark", { method: "POST", body });
}

export async function apiTeacherDashboard(
  date: string,
  shift?: string,
): Promise<ApiTeacherDashboardResponse> {
  const params = new URLSearchParams({ date });
  if (shift) params.set("shift", shift);
  return api<ApiTeacherDashboardResponse>(
    `/teacher-attendance/dashboard?${params}`,
  );
}

// ── Attendance officers ────────────────────────────────────────────────────
// Where each officer may take attendance. A null section means the whole
// class; a null shift means every shift — both widen rather than restrict.

export interface AttendanceGrant {
  id: string;
  classId: string;
  sectionId: string | null;
  shiftId: string | null;
  class: { id: string; name: string };
  section: { id: string; name: string } | null;
  shift: { id: string; name: string } | null;
}

export interface AttendanceOfficer {
  id: string;
  username: string;
  fullName: string | null;
  status: string;
  createdAt: string;
  assignments: AttendanceGrant[];
}

export interface GrantInput {
  classId: string;
  sectionId?: string | null;
  shiftId?: string | null;
}

export const apiListAttendanceOfficers = () =>
  api<AttendanceOfficer[]>("/attendance-officers");

export const apiSetAttendanceAssignments = (
  userId: string,
  assignments: GrantInput[],
) =>
  api<{
    count: number;
    conflicts: {
      officer: string;
      className: string;
      section: string | null;
      shift: string | null;
    }[];
  }>("/attendance-officers/assignments", {
    method: "POST",
    body: { userId, assignments },
  });

/** The classes the signed-in account may take attendance for. */
export const apiMyAttendanceAssignments = () =>
  api<AttendanceGrant[]>("/student-attendance/my-assignments");

/** One register on one day, as it stands for the officer who holds it. */
export interface MyDayRegister {
  id: string;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  shiftId: string | null;
  shiftName: string | null;
  total: number;
  marked: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  state: "EMPTY" | "NOT_STARTED" | "PARTIAL" | "DONE";
  markedByOthers: string[];
  lastMarkedAt: string | null;
}

/** Every register this account holds for one day, with how far each has got. */
export const apiMyAttendanceDay = (date: string) =>
  api<{ date: string; registers: MyDayRegister[] }>(
    `/student-attendance/my-day?date=${encodeURIComponent(date)}`,
  );

// ── Admin monitoring ───────────────────────────────────────────────────────

export interface MonitoringRegister {
  classId: string;
  className: string;
  shiftId: string | null;
  shiftName: string | null;
  total: number;
  marked: number;
  present: number;
  absent: number;
  state: "TAKEN" | "PARTIAL" | "NOT_TAKEN" | "EMPTY";
  takenBy: { userId: string; name: string; role: string | null }[];
  firstMarkedAt: string | null;
  /** Taken after the school lock time — administrators are exempt from it. */
  afterLock: boolean;
}

export interface OfficerPerformance {
  userId: string;
  name: string;
  username: string;
  status: string;
  assignments: number;
  expected: number;
  taken: number;
  missed: number;
  studentsMarked: number;
  rate: number | null;
}

/** Every register for one day and who took it, including the untaken ones. */
export const apiAttendanceMonitoring = (date: string) =>
  api<{ date: string; lockTime: string | null; registers: MonitoringRegister[] }>(
    `/attendance-officers/monitoring?date=${encodeURIComponent(date)}`,
  );

/** How each officer kept up over a range, measured against their own grants. */
export const apiOfficerPerformance = (from: string, to: string) =>
  api<{
    from: string;
    to: string;
    schoolDays: number;
    officers: OfficerPerformance[];
  }>(
    `/attendance-officers/performance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
