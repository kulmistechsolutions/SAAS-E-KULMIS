"use client";

import { useSyncExternalStore } from "react";
import { buildPlatformSeed, previewDashboard } from "./seed";
import type {
  CreateSchoolPayload,
  PlatformDashboard,
  PlatformSchool,
  UpdateSchoolPayload,
} from "./types";

const KEY = "ekulmis_platform_schools_v1";

let schools: PlatformSchool[] | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function ensure(): PlatformSchool[] {
  if (schools) return schools;
  if (typeof window === "undefined") return buildPlatformSeed();
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      schools = JSON.parse(raw) as PlatformSchool[];
      return schools;
    } catch {
      /* fall through */
    }
  }
  schools = buildPlatformSeed();
  localStorage.setItem(KEY, JSON.stringify(schools));
  return schools;
}

function persist(next: PlatformSchool[]) {
  schools = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  emit();
}

export function usePlatformSchoolsState(): PlatformSchool[] {
  return useSyncExternalStore(subscribe, ensure, () => buildPlatformSeed());
}

export function listPreviewSchools(): PlatformSchool[] {
  return [...ensure()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getPreviewSchool(id: string): PlatformSchool | null {
  return ensure().find((s) => s.id === id) ?? null;
}

export function previewDashboardStats(): PlatformDashboard {
  return previewDashboard(ensure());
}

export function createPreviewSchool(
  payload: CreateSchoolPayload,
): { school: PlatformSchool; admin: { username: string } } {
  const st = ensure();
  if (st.some((s) => s.subdomain === payload.subdomain.toLowerCase())) {
    throw new Error("That subdomain is already taken.");
  }
  const school: PlatformSchool = {
    id: `sch_${Date.now()}`,
    name: payload.name.trim(),
    subdomain: payload.subdomain.toLowerCase(),
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    trialEndsAt: new Date(
      Date.now() + (payload.trialDays ?? 7) * 86400000,
    ).toISOString(),
    userCount: 1,
  };
  persist([school, ...st]);
  return { school, admin: { username: payload.adminUsername } };
}

export function updatePreviewSchool(
  id: string,
  payload: UpdateSchoolPayload,
): PlatformSchool {
  const st = ensure();
  const idx = st.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("School not found.");
  const updated: PlatformSchool = {
    ...st[idx],
    name: payload.name ?? st[idx].name,
    status: payload.status ?? st[idx].status,
  };
  const next = [...st];
  next[idx] = updated;
  persist(next);
  return updated;
}

export function deletePreviewSchool(id: string): void {
  const st = ensure();
  if (!st.some((s) => s.id === id)) throw new Error("School not found.");
  persist(st.filter((s) => s.id !== id));
}
