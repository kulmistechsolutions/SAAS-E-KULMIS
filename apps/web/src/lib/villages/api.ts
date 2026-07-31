"use client";

import { api } from "@/lib/api";
import type { EntityStatus } from "@/lib/academics/types";

/**
 * A school's own neighborhood list — an optional field on student
 * registration, independent of the custom academic structure. Every school
 * gets this, not just ones using a custom Level/Stage ladder.
 */
export interface ApiVillage {
  id: string;
  name: string;
  orderIndex: number;
  status: EntityStatus;
}

export const apiListVillages = (includeInactive?: boolean) =>
  api<ApiVillage[]>(
    `/villages${includeInactive ? "?includeInactive=true" : ""}`,
  );

export const apiCreateVillage = (body: { name: string; orderIndex?: number }) =>
  api<ApiVillage>("/villages", { method: "POST", body });

export const apiUpdateVillage = (
  id: string,
  body: { name?: string; orderIndex?: number; status?: EntityStatus },
) => api<ApiVillage>(`/villages/${id}`, { method: "PATCH", body });

export const apiDeleteVillage = (id: string) =>
  api<{ success: boolean }>(`/villages/${id}`, { method: "DELETE" });
