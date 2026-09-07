"use client";

import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";

/**
 * What the signed-in user may actually do, as the server sees it.
 *
 * Every screen used to work this out from a table compiled into the app, so a
 * school that changed a role's permissions changed nothing anyone could see
 * beyond the one browser that made the change. This holds the server's answer
 * — product defaults and the school's own overrides already merged — and it
 * is the only thing the sidebar, the route guard and the action buttons are
 * allowed to read.
 */

export type Grants = Record<string, string[] | undefined>;

interface State {
  role: string | null;
  grants: Grants;
  /**
   * Whether the answer has arrived. Screens must wait for it rather than
   * guess: guessing "allowed" opens pages the school closed, and guessing
   * "denied" throws an administrator out of their own system for a second on
   * every page load.
   */
  loaded: boolean;
}

const EMPTY: State = { role: null, grants: {}, loaded: false };
let state: State = EMPTY;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Ask the server again — after signing in, and after permissions change. */
export async function refreshPermissions(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await api<{ role: string; permissions: Grants }>(
        "/permissions/me",
      );
      state = { role: res.role, grants: res.permissions ?? {}, loaded: true };
    } catch {
      // A failed fetch is not a grant. Marked loaded so screens stop waiting,
      // holding nothing — which shows the "no access" screen rather than
      // silently opening everything.
      state = { role: null, grants: {}, loaded: true };
    } finally {
      inFlight = null;
      emit();
    }
  })();
  return inFlight;
}

/** Forget everything on sign-out, so the next user never inherits this one's. */
export function clearPermissions(): void {
  state = EMPTY;
  inFlight = null;
  emit();
}

export function getPermissionsState(): State {
  return state;
}

export function usePermissions(): State {
  return useSyncExternalStore(subscribe, getPermissionsState, () => EMPTY);
}

/**
 * Whether the user may do one thing — `can("fees.update")`.
 *
 * Deny by default in every unknown case: not loaded, no module, no action.
 */
export function can(permission: string): boolean {
  const [module, action] = permission.split(".");
  if (!module || !action) return false;
  return (state.grants[module] ?? []).includes(action);
}

/** Any one of them is enough. */
export function canAny(...permissions: string[]): boolean {
  return permissions.some((p) => can(p));
}
