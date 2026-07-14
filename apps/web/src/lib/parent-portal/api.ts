"use client";

import { api, clearAuthTokens, setAccessToken, setRefreshToken } from "@/lib/api";
import type { Gender, StudentStatus } from "@/lib/students/types";
import type { PortalAnnouncement, PortalNotification } from "./types";

export interface ApiPortalChild {
  id: string;
  code: string;
  fullName: string;
  gender: Gender;
  dob: string | null;
  phone: string | null;
  monthlyFee: number;
  status: StudentStatus;
  parentId: string;
  classId: string;
  sectionId: string | null;
  class: { name: string; academicYear: { name: string } | null };
  section: { name: string } | null;
}

export interface ApiPortalAttendance {
  id: string;
  date: string;
  status: string;
  notes: string | null;
}

export interface ApiPortalFeeLedger {
  student: { id: string; code: string; fullName: string; monthlyFee: number };
  charges: {
    id: string;
    year: number;
    month: number;
    amount: number;
    paidAmount: number;
    status: string;
  }[];
  payments: unknown[];
  outstanding: number;
}

export interface ApiPortalExamResult {
  examId: string;
  examName: string;
  term: string;
  weightPercent: number;
  subjects: {
    subject: string;
    maxMarks: number;
    marksObtained: number | null;
    grade: string;
  }[];
  totalObtained: number;
  totalMax: number;
  average: number;
  grade: string;
  passed: boolean;
}

export interface ApiPortalStudentResults {
  studentId: string;
  studentCode: string;
  studentName: string;
  className: string;
  section: string | null;
  termResults: ApiPortalExamResult[];
  finalAverage: number;
  finalGrade: string;
  passed: boolean;
}

export interface ApiNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

export interface ApiAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string;
}

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

export async function apiPortalLogin(
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
  const user = await api<PortalAuthUser>("/auth/me");
  return { user };
}

export function apiPortalLogout() {
  clearAuthTokens();
}

export const apiPortalChildren = () => api<ApiPortalChild[]>("/parent-portal/children");

export const apiPortalAttendance = (studentId: string) =>
  api<ApiPortalAttendance[]>(`/parent-portal/children/${studentId}/attendance`);

export const apiPortalFees = (studentId: string) =>
  api<ApiPortalFeeLedger>(`/parent-portal/children/${studentId}/fees`);

export const apiPortalResults = (studentId: string) =>
  api<ApiPortalStudentResults>(`/parent-portal/children/${studentId}/results`);

export const apiPortalNotifications = () =>
  api<ApiNotification[]>("/parent-portal/notifications");

export const apiPortalAnnouncements = () =>
  api<ApiAnnouncement[]>("/parent-portal/announcements");

export function mapPortalChild(c: ApiPortalChild) {
  return {
    id: c.id,
    code: c.code,
    fullName: c.fullName,
    gender: c.gender,
    dob: c.dob ? c.dob.slice(0, 10) : null,
    phone: c.phone,
    parentId: c.parentId,
    className: c.class?.name ?? "",
    section: c.section?.name ?? null,
    monthlyFee: c.monthlyFee,
    academicYear: c.class?.academicYear?.name ?? "",
    registrationDate: "",
    status: c.status,
    notes: null as string | null,
  };
}

export function mapPortalNotification(n: ApiNotification, parentId: string): PortalNotification {
  return {
    id: n.id,
    parentId,
    studentId: null,
    type: (n.type as PortalNotification["type"]) || "ANNOUNCEMENT",
    title: n.title,
    message: n.body,
    createdAt: n.createdAt,
    read: n.readAt !== null,
  };
}

export function mapPortalAnnouncement(a: ApiAnnouncement): PortalAnnouncement {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    category: "GENERAL",
    publishedAt: a.publishedAt,
    pinned: false,
  };
}
