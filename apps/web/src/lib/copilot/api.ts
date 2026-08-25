"use client";

import { api } from "@/lib/api";

export interface CopilotOverview {
  period: { month: string; from: string; to: string; academicYear: string | null };
  students: { total: number; male: number; female: number; newThisMonth: number };
  staff: { teachers: number; parents: number };
  academics: { classes: number; sections: number; exams: number };
  attendance: {
    todayPresent: number; todayAbsent: number; todayLate: number;
    monthRate: number | null; previousMonthRate: number | null;
  };
  teacherAttendance: { present: number; absent: number; rate: number | null };
  fees: {
    expectedThisMonth: number; collectedThisMonth: number; collectedToday: number;
    outstanding: number; collectionRate: number | null;
  };
  finance: {
    feeIncome: number; otherIncome: number; totalIncome: number;
    salaries: number; expenses: number; netIncome: number;
  };
  quiz: { attempts: number; averagePercent: number | null; passRate: number | null };
}

export interface RankedStudent {
  studentId: string; code: string; name: string;
  className: string | null; value: number;
}

export interface CopilotStudents {
  rankedOn: string;
  studentsRanked: number;
  studentsUnranked: number;
  top: RankedStudent[];
  needsAttention: RankedStudent[];
}

export interface CopilotRisks {
  period: string;
  lowAttendance: {
    code: string; name: string; className: string | null;
    rate: number | null; daysRecorded: number;
  }[];
  owing: { code: string; name: string; className: string | null; owed: number }[];
}

export const fetchCopilotOverview = (month?: string) =>
  api<CopilotOverview>(`/copilot/overview${month ? `?month=${month}` : ""}`);

export const fetchCopilotStudents = (limit = 10) =>
  api<CopilotStudents>(`/copilot/students?limit=${limit}`);

export const fetchCopilotRisks = (month?: string) =>
  api<CopilotRisks>(`/copilot/risks${month ? `?month=${month}` : ""}`);

export interface CopilotBrief {
  period: CopilotOverview["period"];
  available: boolean;
  summary: string | null;
  basedOn: string;
}

export interface CopilotQuota {
  used: number;
  limit: number;
  remaining: number;
}

export interface CopilotHistoryItem {
  id: string;
  question: string;
  answer: string;
  username: string | null;
  createdAt: string;
}

export type CopilotAnswer =
  | { ok: true; answer: string; remaining: number }
  | { ok: false; reason: "limit" | "unavailable"; remaining: number };

export const fetchCopilotBrief = (month?: string) =>
  api<CopilotBrief>(`/copilot/brief${month ? `?month=${month}` : ""}`);

export const fetchCopilotQuota = () => api<CopilotQuota>("/copilot/quota");

export const fetchCopilotHistory = () =>
  api<CopilotHistoryItem[]>("/copilot/history");

export const askCopilot = (question: string) =>
  api<CopilotAnswer>("/copilot/ask", { method: "POST", body: { question } });
