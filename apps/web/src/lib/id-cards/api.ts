"use client";

import { api } from "@/lib/api";
import type { CardDesign, CardElement } from "./elements";

/**
 * Saved card layouts live on the server so every admin in a school sees the
 * same design. They used to sit in localStorage, which meant a layout drawn on
 * the office PC did not exist on anyone else's machine.
 */

export interface StoredCardDesign {
  designKey: string;
  styleId: string;
  orientation: string;
  accent: string;
  width: number;
  height: number;
  elements: CardElement[];
  updatedAt: string;
}

export async function apiListCardDesigns(): Promise<StoredCardDesign[]> {
  return api<StoredCardDesign[]>("/card-designs");
}

export async function apiSaveCardDesign(
  designKey: string,
  styleId: string,
  orientation: string,
  design: CardDesign,
): Promise<{ designKey: string }> {
  return api<{ designKey: string }>("/card-designs", {
    method: "POST",
    body: {
      designKey,
      styleId,
      orientation,
      accent: design.accent,
      width: design.width,
      height: design.height,
      elements: design.elements,
    },
  });
}

export async function apiDeleteCardDesign(designKey: string): Promise<{ removed: number }> {
  return api<{ removed: number }>(`/card-designs/${encodeURIComponent(designKey)}`, {
    method: "DELETE",
  });
}

/** Server rows → the shape the page keeps in state. */
export function toDesignMap(rows: StoredCardDesign[]): Record<string, CardDesign> {
  const out: Record<string, CardDesign> = {};
  for (const r of rows) {
    if (!r.width || !r.height || !Array.isArray(r.elements)) continue;
    out[r.designKey] = { width: r.width, height: r.height, accent: r.accent, elements: r.elements };
  }
  return out;
}

// ── Generation history & reprints (PRD §24-27) ────────────────────────────

export interface CardIssueRow {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  cardType: string;
  styleId: string;
  orientation: string;
  academicYear: string | null;
  className: string | null;
  section: string | null;
  batchId: string;
  status: string;
  isReprint: boolean;
  reprintReason: string | null;
  voidReason: string | null;
  createdAt: string;
  issueCount?: number;
}

export interface RecordIssuesInput {
  cardType: string;
  styleId: string;
  orientation: string;
  academicYear?: string;
  isReprint?: boolean;
  reprintOfId?: string;
  reprintReason?: string;
  students: {
    studentId: string;
    studentCode: string;
    studentName: string;
    className?: string;
    section?: string;
  }[];
}

export async function apiRecordCardIssues(
  body: RecordIssuesInput,
): Promise<{ batchId: string; recorded: number }> {
  return api<{ batchId: string; recorded: number }>("/card-issues", {
    method: "POST",
    body,
  });
}

export async function apiMarkBatchPrinted(batchId: string): Promise<{ updated: number }> {
  return api<{ updated: number }>(`/card-issues/${encodeURIComponent(batchId)}/printed`, {
    method: "POST",
  });
}

export async function apiListCardIssues(params?: {
  search?: string;
  cardType?: string;
  status?: string;
  limit?: number;
}): Promise<CardIssueRow[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.cardType) qs.set("cardType", params.cardType);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return api<CardIssueRow[]>(`/card-issues${q ? `?${q}` : ""}`);
}

export async function apiCardIssueSummary(): Promise<Record<string, number>> {
  return api<Record<string, number>>("/card-issues/summary");
}

export interface ClearanceRow {
  studentId: string;
  feesOwed: number;
  booksOut: number;
  status: string;
  detail: string;
}

/** Real clearance status for a batch of students (PRD §23). */
export async function apiClearanceFor(studentIds: string[]): Promise<ClearanceRow[]> {
  if (studentIds.length === 0) return [];
  return api<ClearanceRow[]>("/card-issues/clearance", {
    method: "POST",
    body: { studentIds },
  });
}

export interface CardReportStudent {
  code: string;
  name: string;
  className: string;
  section: string;
}

export interface CardReport {
  counts: Record<string, number>;
  withoutPhotos: CardReportStudent[];
  withoutCards: CardReportStudent[];
}

/** ID card reports (PRD §29). */
export async function apiCardReport(): Promise<CardReport> {
  return api<CardReport>("/card-issues/report");
}

/** Void a record (issued in error). The row is kept and marked CANCELLED. */
export async function apiVoidCardIssue(
  id: string,
  reason: string,
): Promise<{ updated: number }> {
  return api<{ updated: number }>(`/card-issues/${encodeURIComponent(id)}/void`, {
    method: "POST",
    body: { reason },
  });
}
