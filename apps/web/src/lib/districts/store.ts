"use client";

import { useSyncExternalStore } from "react";
import { apiListDistricts, type ApiDistrict } from "./api";

/**
 * A small standalone cache, mirroring villages/store.ts exactly — districts
 * have no year/hierarchy to key by either.
 */
let districts: ApiDistrict[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

export async function refreshDistricts(): Promise<void> {
  try {
    districts = await apiListDistricts();
  } catch {
    /* keep existing cache; callers surface load errors via empty state */
  } finally {
    loaded = true;
    emit();
  }
}

/** Fetches once per session; call again after a create/update/delete. */
export async function ensureDistrictsLoaded(): Promise<void> {
  if (loaded) return;
  if (!loading) loading = refreshDistricts().finally(() => { loading = null; });
  await loading;
}

function getDistricts(): ApiDistrict[] {
  if (!loaded && typeof window !== "undefined" && !loading) void ensureDistrictsLoaded();
  return districts;
}

export function useDistrictsState(): ApiDistrict[] {
  return useSyncExternalStore(subscribe, getDistricts, () => []);
}

export function districtNameById(id: string | null | undefined): string | null {
  if (!id) return null;
  return districts.find((d) => d.id === id)?.name ?? null;
}

export function districtIdByName(name: string): string | null {
  const key = name.trim().toLowerCase();
  return districts.find((d) => d.name.trim().toLowerCase() === key)?.id ?? null;
}
