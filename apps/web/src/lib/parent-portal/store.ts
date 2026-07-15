"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import { attendanceHistory } from "@/lib/students/history";
import {
  changeParentPassword,
  getParent,
  getParentWithChildren,
  type ParentDashboardSummary,
} from "@/lib/students/store";
import type { Parent, Student } from "@/lib/students/types";
import {
  apiPortalAnnouncements,
  apiPortalAttendance,
  apiPortalChildren,
  apiPortalFees,
  apiPortalLogin,
  apiPortalLogout,
  apiPortalMe,
  apiPortalNotifications,
  apiPortalResults,
  mapPortalAnnouncement,
  mapPortalChild,
  mapPortalNotification,
  type PortalAuthUser,
} from "./api";
import { portalDevice } from "./format";
import type {
  PortalAnnouncement,
  PortalAuditAction,
  PortalAuditEntry,
  PortalNotification,
  PortalSession,
  PortalState,
} from "./types";
import type { FeePayment } from "@/lib/fees/types";
import type { StudentExamResult } from "@/lib/examinations/types";
import type { PromotionRow } from "@/lib/students/history";

const EMPTY: PortalState = {
  session: null,
  selectedChildByParent: {},
  announcements: [],
  notifications: [],
  audit: [],
  parentProfile: null,
};

let state: PortalState | null = null;
let childrenCache: Student[] = [];
let authUser: PortalAuthUser | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function ensure(): PortalState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem("ekulmis_parent_portal_session_v1");
  if (raw) {
    try {
      const session = JSON.parse(raw) as PortalSession;
      state = { ...EMPTY, session };
      void refreshPortalData();
      return state;
    } catch {
      /* fall through */
    }
  }
  state = EMPTY;
  return state;
}

function setState(next: PortalState) {
  state = next;
  emit();
}

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export async function refreshPortalData(): Promise<void> {
  if (!ensure().session) return;
  try {
    const [me, children, announcements, notifications] = await Promise.all([
      apiPortalMe(),
      apiPortalChildren(),
      apiPortalAnnouncements(),
      apiPortalNotifications(),
    ]);
    childrenCache = children.map(mapPortalChild);
    const parentId = ensure().session!.parentId;
    setState({
      ...ensure(),
      parentProfile: me,
      announcements: announcements.map(mapPortalAnnouncement),
      notifications: notifications.map((n) => mapPortalNotification(n, parentId)),
    });
  } catch {
    /* keep cache */
  }
}

export function getPortalState(): PortalState {
  return ensure();
}

export function usePortalState(): PortalState {
  return useSyncExternalStore(subscribe, getPortalState, () => EMPTY);
}

function clientIp(): string {
  return "127.0.0.1";
}

export function logPortalAudit(
  parentId: string,
  action: PortalAuditAction,
  studentId: string | null = null,
  detail?: string,
) {
  const s = ensure();
  const entry: PortalAuditEntry = {
    id: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    parentId,
    studentId,
    action,
    detail,
    at: new Date().toISOString(),
    ip: clientIp(),
    device: portalDevice(),
  };
  setState({ ...s, audit: [entry, ...s.audit].slice(0, 500) });
}

export async function loginParent(
  identifier: string,
  password: string,
): Promise<{ ok: boolean; error?: string; parent?: Parent }> {
  try {
    const { user } = await apiPortalLogin(identifier, password);
    if (user.role !== "PARENT" && user.role !== "ADMINISTRATOR") {
      apiPortalLogout();
      return { ok: false, error: "This account is not a parent portal user." };
    }
    authUser = user;

    const children = await apiPortalChildren();
    childrenCache = children.map(mapPortalChild);
    const parentId = children[0]?.parentId ?? user.userId;

    const session: PortalSession = { parentId, loginAt: new Date().toISOString() };
    if (typeof window !== "undefined") {
      localStorage.setItem("ekulmis_parent_portal_session_v1", JSON.stringify(session));
    }
    setState({ ...ensure(), session });
    await refreshPortalData();
    logPortalAudit(parentId, "LOGIN");
    return { ok: true, parent: currentParent() ?? undefined };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Invalid Parent ID or password.") };
  }
}

export function logoutParent() {
  const s = ensure();
  if (s.session) logPortalAudit(s.session.parentId, "LOGOUT");
  apiPortalLogout();
  authUser = null;
  childrenCache = [];
  if (typeof window !== "undefined") {
    localStorage.removeItem("ekulmis_parent_portal_session_v1");
  }
  setState({ ...s, session: null, parentProfile: null });
}

export function currentSession(): PortalSession | null {
  return ensure().session;
}

export function currentParent(): Parent | null {
  const sess = currentSession();
  if (!sess) return null;
  const profile = ensure().parentProfile;
  if (profile) {
    return {
      id: profile.id,
      code: profile.code,
      name: profile.name,
      phone: profile.phone,
      altPhone: profile.altPhone,
      email: profile.email,
      address: profile.address,
      occupation: profile.occupation,
      registrationDate: profile.createdAt,
      status: profile.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      username: profile.code,
      password: "",
    };
  }
  return getParent(sess.parentId) ?? {
    id: sess.parentId,
    code: authUser?.username ?? sess.parentId,
    name: authUser?.username ?? "Parent",
    phone: "",
    altPhone: null,
    email: null,
    address: null,
    occupation: null,
    registrationDate: sess.loginAt,
    status: "ACTIVE",
    username: authUser?.username ?? "",
    password: "",
  };
}

export function parentChildren(_parentId: string): Student[] {
  return childrenCache;
}

export function assertChildAccess(_parentId: string, studentId: string): Student | null {
  return childrenCache.find((c) => c.id === studentId) ?? null;
}

export function getSelectedChildId(parentId: string): string | null {
  const s = ensure();
  const saved = s.selectedChildByParent[parentId];
  const children = parentChildren(parentId);
  if (saved && children.some((c) => c.id === saved)) return saved;
  return children[0]?.id ?? null;
}

export function setSelectedChild(parentId: string, studentId: string) {
  const child = assertChildAccess(parentId, studentId);
  if (!child) return;
  const s = ensure();
  setState({
    ...s,
    selectedChildByParent: { ...s.selectedChildByParent, [parentId]: studentId },
  });
}

export function portalDashboardSummary(parentId: string): ParentDashboardSummary {
  const children = parentChildren(parentId);
  let attSum = 0;
  for (const c of children) {
    attSum += attendanceHistory(c, 30).percentage;
  }
  const attPct = children.length ? Math.round(attSum / children.length) : 0;

  return {
    totalChildren: children.length,
    activeStudents: children.filter((c) => c.status === "ACTIVE").length,
    outstandingFees: 0,
    totalFeesPaid: 0,
    attendancePercentage: attPct,
    upcomingExams: 0,
    activeQuizzes: 0,
    latestGrade: "—",
  };
}

export function portalChangePassword(
  parentId: string,
  current: string,
  next: string,
): { ok: boolean; error?: string } {
  const result = changeParentPassword(parentId, current, next);
  if (result.ok) logPortalAudit(parentId, "PASSWORD_CHANGED");
  return result;
}

export function listAnnouncements(): PortalAnnouncement[] {
  return [...ensure().announcements].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function parentNotifications(parentId: string): PortalNotification[] {
  return ensure()
    .notifications.filter((n) => n.parentId === parentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function unreadNotificationCount(parentId: string): number {
  return parentNotifications(parentId).filter((n) => !n.read).length;
}

export function markNotificationRead(id: string) {
  const s = ensure();
  setState({
    ...s,
    notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
  });
}

export function markAllNotificationsRead(parentId: string) {
  const s = ensure();
  setState({
    ...s,
    notifications: s.notifications.map((n) =>
      n.parentId === parentId ? { ...n, read: true } : n,
    ),
  });
}

export async function fetchChildAttendance(studentId: string) {
  return apiPortalAttendance(studentId);
}

export async function fetchChildFees(studentId: string) {
  return apiPortalFees(studentId);
}

export async function fetchChildExamResults(studentId: string): Promise<{
  blocked: boolean;
  results: StudentExamResult[];
  finalAverage?: number;
  finalGrade?: string;
  passed?: boolean;
}> {
  try {
    const data = await apiPortalResults(studentId);
    const results: StudentExamResult[] = data.termResults.map((tr) => ({
      examId: tr.examId,
      examName: tr.examName,
      term: tr.term,
      weightPercent: tr.weightPercent,
      subjects: tr.subjects.map((s) => ({
        subject: s.subject,
        maxMarks: s.maxMarks,
        marksObtained: s.marksObtained ?? 0,
        grade: s.grade,
      })),
      totalObtained: tr.totalObtained,
      totalMax: tr.totalMax,
      average: tr.average,
      grade: tr.grade,
      passed: tr.passed,
    }));
    return {
      blocked: false,
      results,
      finalAverage: data.finalAverage,
      finalGrade: data.finalGrade,
      passed: data.passed,
    };
  } catch {
    return { blocked: false, results: [] };
  }
}

export function childExamResults(_studentId: string) {
  return { blocked: false as const, results: [] as StudentExamResult[] };
}

export function childFeeSummary(student: Student) {
  return {
    monthlyFee: student.monthlyFee,
    outstanding: 0,
    paidMonths: 0,
    partialMonths: 0,
    advanceMonths: 0,
    carryForward: 0,
    ledger: [] as {
      monthKey: string;
      monthLabel: string;
      monthlyCharge: number;
      amountPaid: number;
      remainingBalance: number;
      status: string;
    }[],
  };
}

export async function loadChildFeeSummary(student: Student) {
  try {
    const data = await apiPortalFees(student.id);
    const ledger = data.charges.map((c) => {
      const monthKey = `${c.year}-${String(c.month).padStart(2, "0")}`;
      const remainingBalance = Math.max(0, c.amount - c.paidAmount);
      return {
        monthKey,
        monthLabel: monthKey,
        monthlyCharge: c.amount,
        amountPaid: c.paidAmount,
        remainingBalance,
        status: c.status,
      };
    });
    const paidMonths = ledger.filter((r) => r.status === "PAID").length;
    const partial = ledger.filter((r) => r.status === "PARTIAL").length;
    const advance = ledger.filter((r) => r.status === "ADVANCE").length;
    return {
      monthlyFee: data.student.monthlyFee,
      outstanding: data.outstanding,
      paidMonths,
      partialMonths: partial,
      advanceMonths: advance,
      carryForward: data.outstanding,
      ledger,
    };
  } catch {
    return childFeeSummary(student);
  }
}

export function childQuizRows(_studentId: string): {
  assigned: import("@/lib/quiz/types").StudentQuizRow[];
  history: ReturnType<typeof import("@/lib/quiz/store").studentQuizHistory>;
} {
  return { assigned: [], history: [] };
}

export function childAcademicHistory(_student: Student): PromotionRow[] {
  return [];
}

export function portalAuditForParent(parentId: string): PortalAuditEntry[] {
  return ensure().audit.filter((a) => a.parentId === parentId);
}

export function studentPayments(_studentId: string): FeePayment[] {
  return [];
}

export { getParentWithChildren };
