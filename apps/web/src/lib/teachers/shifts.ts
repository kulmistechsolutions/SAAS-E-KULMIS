"use client";

import { useSyncExternalStore } from "react";
import { apiListAttendanceShifts, type ApiShift } from "@/lib/attendance/api";

/**
 * A school's own named shift list (Settings → Attendance → Attendance Shift
 * Management) — shared here because a teacher's own shift(s), a single
 * assignment row's shift, and teacher attendance all now reference the same
 * AttendanceShift ids instead of a fixed Morning/Afternoon pair.
 */
let shifts: ApiShift[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function ensureShiftsLoaded(): void {
  if (loaded || loading) return;
  // Includes retired shifts. This list is the only place a teacher's own
  // shift, an assignment's shift, or a salary row's shift gets turned back
  // into a name — a shift retired after people were assigned to it must
  // still resolve, or every record that references it shows a raw id
  // forever instead of the name it once had.
  loading = apiListAttendanceShifts(true)
    .then((rows) => {
      shifts = rows;
      loaded = true;
    })
    .catch(() => {
      // `loaded` deliberately left false so the next call retries instead of
      // being stuck on an empty list (and therefore raw ids) for the rest of
      // the session — one bad request should not be permanent.
    })
    .finally(() => {
      loading = null;
      notify();
    });
}

/** Re-fetch after a shift is added/renamed/retired elsewhere. */
export function refreshShifts(): void {
  loaded = false;
  ensureShiftsLoaded();
}

export function getShifts(): ApiShift[] {
  ensureShiftsLoaded();
  return shifts;
}

export function useShifts(): ApiShift[] {
  ensureShiftsLoaded();
  return useSyncExternalStore(subscribe, () => shifts, () => []);
}

/** Shift id -> display name, falling back to the raw id while still loading. */
export function shiftName(id: string | null | undefined): string {
  if (!id) return "—";
  return shifts.find((s) => s.id === id)?.name ?? id;
}
