"use client";

import { api } from "@/lib/api";
import type { EntityStatus } from "@/lib/academics/types";

/**
 * A school's own district list — offered on the DETAILED registration form.
 * Mirrors villages/api.ts exactly.
 */
export interface ApiDistrict {
  id: string;
  name: string;
  orderIndex: number;
  status: EntityStatus;
}

export const apiListDistricts = (includeInactive?: boolean) =>
  api<ApiDistrict[]>(
    `/districts${includeInactive ? "?includeInactive=true" : ""}`,
  );

export const apiCreateDistrict = (body: { name: string; orderIndex?: number }) =>
  api<ApiDistrict>("/districts", { method: "POST", body });

export const apiUpdateDistrict = (
  id: string,
  body: { name?: string; orderIndex?: number; status?: EntityStatus },
) => api<ApiDistrict>(`/districts/${id}`, { method: "PATCH", body });

export const apiDeleteDistrict = (id: string) =>
  api<{ success: boolean }>(`/districts/${id}`, { method: "DELETE" });
