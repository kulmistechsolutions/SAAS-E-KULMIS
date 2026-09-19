"use client";

import { api, ApiError } from "@/lib/api";

/** Why one student is not being texted. */
export type SkipReason = "NO_MARKS" | "NO_PHONE" | "ALREADY_SENT";

export interface ExamResultRow {
  studentId: string;
  studentName: string;
  studentCode: string;
  parentName: string;
  phone: string;
  body: string;
  characters: number;
  segments: number;
  position: number | null;
  average: number;
  passed: boolean;
  skip: SkipReason | null;
  previouslySentAt: string | null;
}

export interface ExamResultPreview {
  exam: {
    id: string;
    name: string;
    term: string;
    className: string;
    sectionName: string | null;
    academicYear: string;
    status: string;
  };
  templateName: string;
  body: string;
  rows: ExamResultRow[];
  summary: {
    onSheet: number;
    recipients: number;
    messages: number;
    credits: number;
    balance: number;
    shortfall: number;
    noPhone: number;
    noMarks: number;
    alreadySent: number;
    maxCharacters: number;
    maxSegments: number;
  };
}

export interface ExamResultSmsInput {
  examId: string;
  sectionId?: string | null;
  studentIds?: string[];
  templateId?: string;
  body?: string;
  subjects?: string[];
  separator?: string;
  joiner?: string;
}

export interface ExamResultHistory {
  rows: {
    id: string;
    studentName: string;
    studentCode: string;
    recipientName: string | null;
    recipientPhone: string;
    status: string;
    creditsUsed: number;
    error: string | null;
    createdAt: string;
    sentAt: string | null;
    deliveredAt: string | null;
  }[];
  counts: Record<string, number>;
  failed: number;
  credits: number;
}

export async function previewExamResults(
  input: ExamResultSmsInput,
): Promise<ExamResultPreview> {
  return api<ExamResultPreview>("/sms/exam-results/preview", {
    method: "POST",
    body: input,
  });
}

export async function sendExamResults(
  input: ExamResultSmsInput & { resend?: boolean },
): Promise<{ sent: number; failed: number; creditsUsed: number }> {
  return api("/sms/exam-results/send", { method: "POST", body: input });
}

export async function retryExamResults(
  input: ExamResultSmsInput,
): Promise<{ sent: number; failed: number; creditsUsed: number }> {
  return api("/sms/exam-results/retry", { method: "POST", body: input });
}

export async function examResultHistory(
  examId: string,
): Promise<ExamResultHistory> {
  return api<ExamResultHistory>("/sms/exam-results/history", {
    method: "POST",
    body: { examId },
  });
}

/** The server's own words where it has them, rather than a generic failure. */
export function smsError(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.message) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
