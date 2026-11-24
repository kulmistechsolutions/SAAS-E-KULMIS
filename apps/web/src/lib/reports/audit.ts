"use client";

import { useSyncExternalStore } from "react";
import type { ReportAuditAction, ReportAuditEntry } from "./types";

const KEY = "ekulmis_reports_audit_v1";

let entries: ReportAuditEntry[] = [];
let loaded = false;
const listeners = new Set<() => void>();
/** One array for "nothing yet", so the snapshot is the same object every read. */
const EMPTY: ReportAuditEntry[] = [];

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

/**
 * The log, read from storage once.
 *
 * It used to re-read storage whenever the log was empty, returning a fresh
 * [] each time — and useSyncExternalStore treats a snapshot that is a new
 * object on every read as a store that never stops changing, so the first
 * page to subscribe (Financial Reports, in a school that had not yet printed
 * a report) crashed with "This page could not be loaded".
 */
function ensure(): ReportAuditEntry[] {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    const read = load();
    if (read.length) entries = read;
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
    () => EMPTY,
  );
}
