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
  loading = apiListAttendanceShifts()
    .then((rows) => {
      shifts = rows;
      loaded = true;
    })
    .catch(() => {
      loaded = true;
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
