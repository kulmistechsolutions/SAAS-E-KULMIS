"use client";

import { api, clearAuthTokens, setAccessToken, setRefreshToken } from "@/lib/api";
import { setCachedAuthUser, type AuthUser } from "@/lib/auth";
import type { TeacherDashboardResponse } from "@/lib/dashboard/api";
import type { TeacherMe } from "@/lib/teachers/api";
import type {
  TeacherPortalAnnouncement,
  TeacherPortalNotification,
  TeacherPortalPermissions,
} from "./types";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string; role: string; schoolId: string };
}

export interface PortalAuthUser {
  userId: string;
  schoolId: string;
  role: string;
  username: string;
}

export async function apiTeacherPortalLogin(
  identifier: string,
  password: string,
): Promise<{ user: PortalAuthUser }> {
  const res = await api<LoginResponse>("/auth/login", {
    method: "POST",
    body: { identifier, password },
    auth: false,
  });
  setAccessToken(res.accessToken);
  setRefreshToken(res.refreshToken);
  const user = await api<AuthUser>("/auth/me");
  setCachedAuthUser(user);
  return {
    user: {
      userId: user.userId,
      schoolId: user.schoolId,
      role: user.role,
      username: user.username,
    },
  };
}

export function apiTeacherPortalLogout() {
  clearAuthTokens();
  setCachedAuthUser(null);
}

export const apiTeacherPortalProfile = () =>
  api<TeacherMe>("/teacher-portal/profile");

export const apiTeacherPortalDashboard = () =>
  api<TeacherDashboardResponse>("/teacher-portal/dashboard");

export const apiTeacherPortalStudents = () =>
  api<unknown[]>("/teacher-portal/students");

export const apiTeacherPortalPermissions = () =>
  api<TeacherPortalPermissions>("/teacher-portal/permissions");

export const apiTeacherPortalAnnouncements = () =>
  api<TeacherPortalAnnouncement[]>("/teacher-portal/announcements");

export const apiTeacherPortalNotifications = () =>
  api<TeacherPortalNotification[]>("/teacher-portal/notifications");

export interface ClassResultsResponse {
  classId: string;
  sectionId: string;
  academicYearId: string;
  students: { id: string; code: string; fullName: string }[];
  exams: { id: string; name: string; term: string; maxMarks: number }[];
  rows: {
    studentId: string;
    studentCode: string;
    studentName: string;
    examId: string;
    examName: string;
    subjectId: string;
    subjectName: string;
    maxMarks: number;
    marksObtained: number | null;
    percentage: number | null;
    grade: string;
  }[];
  subjectSummaries: {
    subjectId: string;
    subjectName: string;
    studentCount: number;
    averagePercentage: number;
    grade: string;
  }[];
}

export function apiTeacherPortalClassResults(params: {
  academicYearId: string;
  classId: string;
  sectionId: string;
  examId?: string;
}) {
  const q = new URLSearchParams({
    academicYearId: params.academicYearId,
    classId: params.classId,
    sectionId: params.sectionId,
  });
  if (params.examId) q.set("examId", params.examId);
  return api<ClassResultsResponse>(`/teacher-portal/results/class?${q}`);
}

export const apiTeacherPortalStudentResults = (
  studentId: string,
  academicYearId?: string,
) => {
  const q = academicYearId ? `?academicYearId=${academicYearId}` : "";
  return api<unknown>(`/teacher-portal/results/student/${studentId}${q}`);
};
