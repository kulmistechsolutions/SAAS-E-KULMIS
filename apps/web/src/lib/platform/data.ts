"use client";

import {
  createPlatformSchool,
  deletePlatformSchool,
  fetchPlatformDashboard,
  fetchPlatformSchool,
  fetchPlatformSchools,
  updatePlatformSchool,
} from "./api";
import {
  createPreviewSchool,
  deletePreviewSchool,
  getPreviewSchool,
  listPreviewSchools,
  previewDashboardStats,
  updatePreviewSchool,
} from "./store";
import type {
  CreateSchoolPayload,
  PlatformDashboard,
  PlatformSchool,
  UpdateSchoolPayload,
} from "./types";

const PREVIEW =
  process.env.NEXT_PUBLIC_PREVIEW_PLATFORM_AUTH === "true" ||
  process.env.NEXT_PUBLIC_PREVIEW_AUTH === "true";

export function isPlatformPreview(): boolean {
  return PREVIEW;
}

export async function loadDashboard(): Promise<PlatformDashboard> {
  if (PREVIEW) return previewDashboardStats();
  return fetchPlatformDashboard();
}

export async function loadSchools(): Promise<PlatformSchool[]> {
  if (PREVIEW) return listPreviewSchools();
  return fetchPlatformSchools();
}

export async function loadSchool(id: string): Promise<PlatformSchool | null> {
  if (PREVIEW) return getPreviewSchool(id);
  try {
    return await fetchPlatformSchool(id);
  } catch {
    return null;
  }
}

export async function createSchool(payload: CreateSchoolPayload) {
  if (PREVIEW) return createPreviewSchool(payload);
  return createPlatformSchool(payload);
}

export async function updateSchool(id: string, payload: UpdateSchoolPayload) {
  if (PREVIEW) return updatePreviewSchool(id, payload);
  return updatePlatformSchool(id, payload);
}

export async function removeSchool(id: string) {
  if (PREVIEW) return deletePreviewSchool(id);
  return deletePlatformSchool(id);
}
