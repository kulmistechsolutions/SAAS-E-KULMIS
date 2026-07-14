"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import { getCachedAuthUser } from "@/lib/auth";
import type { TeacherMe } from "@/lib/teachers/api";
import { clearTeacherMeCache } from "@/lib/teachers/session";
import {
  apiTeacherPortalLogin,
  apiTeacherPortalLogout,
  apiTeacherPortalPermissions,
  apiTeacherPortalProfile,
} from "./api";
import type { TeacherPortalPermissions, TeacherPortalSession, TeacherPortalState } from "./types";

const STORAGE_KEY = "ekulmis_teacher_portal_session_v1";

const EMPTY: TeacherPortalState = {
  session: null,
  permissions: null,
};

let state: TeacherPortalState | null = null;
let profileCache: TeacherMe | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function ensure(): TeacherPortalState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const session = JSON.parse(raw) as TeacherPortalSession;
      const role = getCachedAuthUser()?.role;
      if (role && role !== "TEACHER") {
        localStorage.removeItem(STORAGE_KEY);
        state = EMPTY;
        return state;
      }
      state = { ...EMPTY, session };
      void refreshTeacherPortal();
      return state;
    } catch {
      /* fall through */
    }
  }
  state = EMPTY;
  return state;
}

function setState(next: TeacherPortalState) {
  state = next;
  emit();
}

export function getTeacherPortalState(): TeacherPortalState {
  return ensure();
}

export function useTeacherPortalState(): TeacherPortalState {
  return useSyncExternalStore(subscribe, getTeacherPortalState, () => EMPTY);
}

export function getCachedTeacherProfile(): TeacherMe | null {
  return profileCache;
}

export async function refreshTeacherPortal(): Promise<void> {
  if (!ensure().session) return;
  const role = getCachedAuthUser()?.role;
  if (role && role !== "TEACHER") {
    logoutTeacher();
    return;
  }
  try {
    const [profile, permissions] = await Promise.all([
      apiTeacherPortalProfile(),
      apiTeacherPortalPermissions(),
    ]);
    profileCache = profile;
    setState({ ...ensure(), permissions });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      logoutTeacher();
    }
  }
}

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export async function loginTeacher(
  identifier: string,
  password: string,
): Promise<{ ok: boolean; error?: string; teacher?: TeacherMe }> {
  try {
    const { user } = await apiTeacherPortalLogin(identifier, password);
    if (user.role !== "TEACHER") {
      apiTeacherPortalLogout();
      return { ok: false, error: "This account is not a teacher portal user." };
    }
    const teacher = await apiTeacherPortalProfile();
    const permissions = await apiTeacherPortalPermissions();
    profileCache = teacher;
    const session: TeacherPortalSession = {
      teacherId: teacher.id,
      loginAt: new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
    setState({ session, permissions });
    return { ok: true, teacher };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Invalid Teacher ID or password.") };
  }
}

export function logoutTeacher() {
  apiTeacherPortalLogout();
  clearTeacherMeCache();
  profileCache = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  setState({ session: null, permissions: null });
}

export function currentTeacherSession(): TeacherPortalSession | null {
  return ensure().session;
}

export function teacherPortalPermissions(): TeacherPortalPermissions | null {
  return ensure().permissions;
}

export function canViewStudents(): boolean {
  return ensure().permissions?.canViewStudents ?? profileCache?.canViewStudents ?? false;
}
