"use client";

import { useSyncExternalStore } from "react";
import { apiListVillages, type ApiVillage } from "./api";

/**
 * A small standalone cache, mirroring the academics store's pattern but for a
 * single flat list — villages have no year/hierarchy to key by.
 */
let villages: ApiVillage[] = [];
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

export async function refreshVillages(): Promise<void> {
  try {
    villages = await apiListVillages();
  } catch {
    /* keep existing cache; callers surface load errors via empty state */
  } finally {
    loaded = true;
    emit();
  }
}

/** Fetches once per session; call again after a create/update/delete. */
export async function ensureVillagesLoaded(): Promise<void> {
  if (loaded) return;
  if (!loading) loading = refreshVillages().finally(() => { loading = null; });
  await loading;
}

function getVillages(): ApiVillage[] {
  if (!loaded && typeof window !== "undefined" && !loading) void ensureVillagesLoaded();
  return villages;
}

export function useVillagesState(): ApiVillage[] {
  return useSyncExternalStore(subscribe, getVillages, () => []);
}

export function villageNameById(id: string | null | undefined): string | null {
  if (!id) return null;
  return villages.find((v) => v.id === id)?.name ?? null;
}

export function villageIdByName(name: string): string | null {
  const key = name.trim().toLowerCase();
  return villages.find((v) => v.name.trim().toLowerCase() === key)?.id ?? null;
}
