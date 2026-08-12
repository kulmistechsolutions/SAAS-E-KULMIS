"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import {
  apiCreateEmployee,
  apiDeleteEmployee,
  apiListEmployees,
  apiUpdateEmployee,
  mapApiEmployee,
} from "./api";
import type { EmployeesState, StaffEmployee, StaffEmployeeInput } from "./types";

const EMPTY: EmployeesState = { employees: [] };

let state: EmployeesState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function setState(next: EmployeesState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

let loadPromise: Promise<void> | null = null;

export async function refreshEmployees(): Promise<void> {
  try {
    const rows = await apiListEmployees();
    setState({ employees: rows.map(mapApiEmployee) });
  } catch {
    /* keep cache */
  }
}

/** Awaitable version of the lazy load `ensure()` kicks off — callers that
 *  need the real list synchronously after (e.g. Generate Payroll, which
 *  would otherwise silently iterate zero staff on a cold tab) must await
 *  this first instead of reading getEmployeesState() straight away. */
export async function ensureEmployeesLoaded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!loaded) {
    loaded = true;
    loadPromise = refreshEmployees();
  }
  await loadPromise;
}

function ensure(): EmployeesState {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    loadPromise = refreshEmployees();
  }
  return state;
}

export function getEmployeesState(): EmployeesState {
  return ensure();
}

export function useEmployeesState(): EmployeesState {
  return useSyncExternalStore(
    subscribe,
    () => ensure(),
    () => EMPTY,
  );
}

export async function createEmployee(
  input: StaffEmployeeInput,
): Promise<{ ok: boolean; error?: string; employee?: StaffEmployee }> {
  try {
    const created = await apiCreateEmployee(input);
    const employee = mapApiEmployee(created);
    setState({ employees: [...state.employees, employee] });
    return { ok: true, employee };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to register employee.") };
  }
}

export async function updateEmployee(
  id: string,
  patch: Partial<StaffEmployeeInput>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const updated = await apiUpdateEmployee(id, patch);
    const employee = mapApiEmployee(updated);
    setState({
      employees: state.employees.map((e) => (e.id === id ? employee : e)),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to update employee.") };
  }
}

export async function deleteEmployee(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiDeleteEmployee(id);
    setState({ employees: state.employees.filter((e) => e.id !== id) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to remove employee.") };
  }
}
