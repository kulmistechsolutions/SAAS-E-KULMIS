"use client";

import { useSyncExternalStore } from "react";
import { attendanceHistory } from "@/lib/students/history";
import {
  changeParentPassword,
  getParent,
  getParentWithChildren,
  getState as getStudentsState,
  parentDashboard,
  type ParentDashboardSummary,
} from "@/lib/students/store";
import type { Parent, Student } from "@/lib/students/types";
import {
  getFeesState,
  outstandingBalance,
  studentLedger,
} from "@/lib/fees/store";
import type { FeePayment } from "@/lib/fees/types";
import {
  isStudentBlocked,
  studentPublishedResults,
  getExaminationsState,
} from "@/lib/examinations/store";
import { quizzesForStudent, studentQuizHistory } from "@/lib/quiz/store";
import { promotionHistory } from "@/lib/parents/history";
import { portalDevice } from "./format";
import { buildPortalSeed } from "./seed";
import type {
  PortalAnnouncement,
  PortalAuditAction,
  PortalAuditEntry,
  PortalNotification,
  PortalSession,
  PortalState,
} from "./types";

const KEY = "ekulmis_parent_portal_v1";

const EMPTY: PortalState = {
  session: null,
  selectedChildByParent: {},
  announcements: [],
  notifications: [],
  audit: [],
};

let state: PortalState | null = null;
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
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      state = JSON.parse(raw) as PortalState;
      return state;
    } catch {
      /* fall through */
    }
  }
  state = buildPortalSeed();
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

function setState(next: PortalState) {
  state = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  emit();
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

export function loginParent(
  identifier: string,
  password: string,
): { ok: boolean; error?: string; parent?: Parent } {
  const id = identifier.trim();
  const parent = getParent(id);
  if (!parent) return { ok: false, error: "Invalid Parent ID or password." };
  if (parent.status !== "ACTIVE")
    return { ok: false, error: "This parent account is inactive. Contact the school." };
  const matchCode = parent.code.toLowerCase() === id.toLowerCase();
  const matchUser = parent.username.toLowerCase() === id.toLowerCase();
  if (!matchCode && !matchUser)
    return { ok: false, error: "Invalid Parent ID or password." };
  if (parent.password !== password)
    return { ok: false, error: "Invalid Parent ID or password." };

  const session: PortalSession = { parentId: parent.id, loginAt: new Date().toISOString() };
  const s = ensure();
  setState({ ...s, session });
  logPortalAudit(parent.id, "LOGIN");
  seedNotificationsForParent(parent.id);
  return { ok: true, parent };
}

export function logoutParent() {
  const s = ensure();
  if (s.session) logPortalAudit(s.session.parentId, "LOGOUT");
  setState({ ...s, session: null });
}

export function currentSession(): PortalSession | null {
  return ensure().session;
}

export function currentParent(): Parent | null {
  const sess = currentSession();
  if (!sess) return null;
  return getParent(sess.parentId);
}

export function parentChildren(parentId: string): Student[] {
  return getStudentsState().students.filter((s) => s.parentId === parentId);
}

export function assertChildAccess(parentId: string, studentId: string): Student | null {
  const child = parentChildren(parentId).find((s) => s.id === studentId);
  return child ?? null;
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
  const st = getStudentsState();
  const base = parentDashboard(parentId, st);
  const children = parentChildren(parentId);

  let outstanding = 0;
  let paid = 0;
  for (const c of children) {
    outstanding += outstandingBalance(c.id);
    paid += getFeesState().payments
      .filter((p: FeePayment) => p.studentId === c.id)
      .reduce((sum: number, p: FeePayment) => sum + p.amount, 0);
  }

  let attSum = 0;
  for (const c of children) {
    attSum += attendanceHistory(c, 30).percentage;
  }
  const attPct = children.length ? Math.round(attSum / children.length) : 0;

  const examState = getExaminationsState();
  const upcoming = examState.exams.filter(
    (e) => e.status === "PUBLISHED" || e.status === "LOCKED",
  ).length;

  let activeQuizzes = 0;
  for (const c of children) {
    activeQuizzes += quizzesForStudent(c.id).filter((q) => q.status === "ACTIVE").length;
  }

  let latestGrade = "—";
  for (const c of children) {
    const results = studentPublishedResults(c.id);
    if (results.length > 0) {
      latestGrade = results[results.length - 1].grade;
      break;
    }
  }

  return {
    ...base,
    outstandingFees: outstanding || base.outstandingFees,
    totalFeesPaid: paid || base.totalFeesPaid,
    attendancePercentage: attPct || base.attendancePercentage,
    upcomingExams: upcoming || base.upcomingExams,
    activeQuizzes: activeQuizzes || base.activeQuizzes,
    latestGrade,
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

function seedNotificationsForParent(parentId: string) {
  const s = ensure();
  if (s.notifications.some((n) => n.parentId === parentId)) return;

  const children = parentChildren(parentId);
  const now = Date.now();
  const items: PortalNotification[] = [];

  children.forEach((c, i) => {
    items.push({
      id: `pn_${parentId}_${i}_att`,
      parentId,
      studentId: c.id,
      type: "ABSENCE",
      title: "Absence recorded",
      message: `${c.fullName} was marked absent yesterday.`,
      createdAt: new Date(now - (i + 1) * 3600000).toISOString(),
      read: false,
    });
    items.push({
      id: `pn_${parentId}_${i}_fee`,
      parentId,
      studentId: c.id,
      type: "FEE_DUE",
      title: "Fee reminder",
      message: `Monthly fee for ${c.fullName} is due soon.`,
      createdAt: new Date(now - (i + 2) * 7200000).toISOString(),
      read: i > 0,
    });
  });

  items.push({
    id: `pn_${parentId}_ann`,
    parentId,
    studentId: null,
    type: "ANNOUNCEMENT",
    title: "New school announcement",
    message: "Mid-Term Examination Timetable has been published.",
    createdAt: new Date(now - 86400000).toISOString(),
    read: false,
  });

  setState({ ...s, notifications: [...items, ...s.notifications] });
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
    notifications: s.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    ),
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

export function studentPayments(studentId: string): FeePayment[] {
  return getFeesState()
    .payments.filter((p: FeePayment) => p.studentId === studentId)
    .sort((a: FeePayment, b: FeePayment) => b.collectedAt.localeCompare(a.collectedAt));
}

export function childFeeSummary(student: Student) {
  const ledger = studentLedger(student.id);
  const paidMonths = ledger.filter((r) => r.status === "PAID").length;
  const partial = ledger.filter((r) => r.status === "PARTIAL").length;
  const advance = ledger.filter((r) => r.status === "ADVANCE").length;
  return {
    monthlyFee: student.monthlyFee,
    outstanding: outstandingBalance(student.id),
    paidMonths,
    partialMonths: partial,
    advanceMonths: advance,
    carryForward: ledger.reduce((s, r) => s + Math.max(0, r.remainingBalance), 0),
    ledger,
  };
}

export function childExamResults(studentId: string) {
  if (isStudentBlocked(studentId)) {
    return { blocked: true as const, results: [] };
  }
  return {
    blocked: false as const,
    results: studentPublishedResults(studentId),
  };
}

export function childQuizRows(studentId: string) {
  const assigned = quizzesForStudent(studentId);
  const history = studentQuizHistory(studentId);
  return { assigned, history };
}

export function childAcademicHistory(student: Student) {
  return promotionHistory(student);
}

export function portalAuditForParent(parentId: string): PortalAuditEntry[] {
  return ensure().audit.filter((a) => a.parentId === parentId);
}

export { getParentWithChildren };
