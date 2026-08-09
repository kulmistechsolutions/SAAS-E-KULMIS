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
  shift: "MORNING" | "AFTERNOON";
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
}): Promise<{ date: string; marked: number; skipped: number }> {
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

export async function apiTeacherRoster(
  shift: "MORNING" | "AFTERNOON",
  date: string,
): Promise<ApiTeacherRosterResponse> {
  const params = new URLSearchParams({ shift, date });
  return api<ApiTeacherRosterResponse>(`/teacher-attendance?${params}`);
}

export async function apiMarkTeacherAttendance(body: {
  shift: "MORNING" | "AFTERNOON";
  date: string;
  records: { teacherId: string; status: ApiAttendanceStatus }[];
}): Promise<{ date: string; shift: string; marked: number; skipped: number }> {
  return api("/teacher-attendance/mark", { method: "POST", body });
}

export async function apiTeacherDashboard(
  date: string,
  shift?: "MORNING" | "AFTERNOON",
): Promise<ApiTeacherDashboardResponse> {
  const params = new URLSearchParams({ date });
  if (shift) params.set("shift", shift);
  return api<ApiTeacherDashboardResponse>(
    `/teacher-attendance/dashboard?${params}`,
  );
}
