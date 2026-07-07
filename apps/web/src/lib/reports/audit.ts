"use client";

import { useSyncExternalStore } from "react";
import type { ReportAuditAction, ReportAuditEntry } from "./types";

const KEY = "ekulmis_reports_audit_v1";

let entries: ReportAuditEntry[] = [];
const listeners = new Set<() => void>();

function load(): ReportAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ReportAuditEntry[];
  } catch {
    /* ignore */
  }
  return [];
}

function ensure(): ReportAuditEntry[] {
  if (entries.length === 0 && typeof window !== "undefined") {
    entries = load();
  }
  return entries;
}

function persist() {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }
  listeners.forEach((l) => l());
}

export function logReportAction(
  category: string,
  reportName: string,
  action: ReportAuditAction,
  detail?: string,
  user = "Admin User",
  role = "ADMINISTRATOR",
) {
  ensure();
  entries = [
    {
      id: `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category,
      reportName,
      action,
      user,
      role,
      at: new Date().toISOString(),
      detail,
    },
    ...entries,
  ].slice(0, 500);
  persist();
}

export function getReportAuditLog(): ReportAuditEntry[] {
  return ensure();
}

export function useReportAudit() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ensure(),
    () => [],
  );
}
