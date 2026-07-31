"use client";

import { api } from "@/lib/api";
import type { EntityStatus } from "./types";
import type { ApiClass, ApiSection } from "./api";

/**
 * The school-defined academic ladder — the optional Level and Stage tiers a
 * school can put above its classes instead of the fixed Grade 1–12 list.
 *
 * A school that leaves the structure switched off owns none of these, so every
 * list here comes back empty and its classes appear under `ungrouped`.
 */

export type RepeatScope = "CLASS" | "STAGE";

export interface AcademicStructureSettings {
  customStructureEnabled: boolean;
  /** How many classes a student passes through in one academic year. */
  termsPerYear: number;
  repeatScope: RepeatScope;
  /** Removes the default Grade 1-12 list from every class picker entirely — not deleted, only hidden. Meaningless while customStructureEnabled is off. */
  hideDefaultGrades: boolean;
}

export interface ApiAcademicStage {
  id: string;
  levelId: string;
  name: string;
  orderIndex: number;
  status: EntityStatus;
}

export interface ApiAcademicLevel {
  id: string;
  academicYearId: string;
  name: string;
  orderIndex: number;
  status: EntityStatus;
  stages: ApiAcademicStage[];
}

type ClassWithSections = ApiClass & { sections: ApiSection[] };

export interface StructureTree {
  // Omit `stages` before widening it — intersecting the two shapes would leave
  // the narrower ApiAcademicStage[] winning and hide `classes`.
  levels: (Omit<ApiAcademicLevel, "stages"> & {
    stages: (ApiAcademicStage & { classes: ClassWithSections[] })[];
    /** Hung straight off the level, the way التمهيد … الفصل الرابع often is. */
    classes: ClassWithSections[];
  })[];
  /** Classes belonging to no level — every class of a default-ladder school. */
  ungrouped: ClassWithSections[];
}

// ── Settings ──
export const apiGetStructureSettings = () =>
  api<AcademicStructureSettings>("/academic-structure/settings");

export const apiUpdateStructureSettings = (body: Partial<AcademicStructureSettings>) =>
  api<AcademicStructureSettings>("/academic-structure/settings", {
    method: "PATCH",
    body,
  });

// ── Tree ──
export const apiStructureTree = (academicYearId: string) =>
  api<StructureTree>(
    `/academic-structure/tree?academicYearId=${encodeURIComponent(academicYearId)}`,
  );

// ── Levels ──
export const apiCreateLevel = (body: {
  academicYearId: string;
  name: string;
  orderIndex?: number;
}) => api<ApiAcademicLevel>("/academic-structure/levels", { method: "POST", body });

export const apiUpdateLevel = (
  id: string,
  body: { name?: string; orderIndex?: number; status?: EntityStatus },
) =>
  api<ApiAcademicLevel>(`/academic-structure/levels/${id}`, {
    method: "PATCH",
    body,
  });

export const apiDeleteLevel = (id: string) =>
  api<{ success: boolean }>(`/academic-structure/levels/${id}`, {
    method: "DELETE",
  });

// ── Stages ──
export const apiCreateStage = (body: {
  levelId: string;
  name: string;
  orderIndex?: number;
}) => api<ApiAcademicStage>("/academic-structure/stages", { method: "POST", body });

export const apiUpdateStage = (
  id: string,
  body: { name?: string; orderIndex?: number; status?: EntityStatus },
) =>
  api<ApiAcademicStage>(`/academic-structure/stages/${id}`, {
    method: "PATCH",
    body,
  });

export const apiDeleteStage = (id: string) =>
  api<{ success: boolean }>(`/academic-structure/stages/${id}`, {
    method: "DELETE",
  });

/**
 * Position in `ids` becomes orderIndex — and orderIndex is what promotion
 * walks, so reordering here rewrites the school's promotion path.
 */
export const apiReorder = (entity: "level" | "stage" | "class", ids: string[]) =>
  api<{ success: boolean; count: number }>(
    `/academic-structure/reorder/${entity}`,
    { method: "POST", body: { ids } },
  );

/** Copy a whole ladder into an empty year, so it is defined once. */
export const apiCloneStructure = (body: {
  fromAcademicYearId: string;
  toAcademicYearId: string;
  includeSections?: boolean;
}) =>
  api<{ levels: number; stages: number; classes: number; sections: number }>(
    "/academic-structure/clone",
    { method: "POST", body },
  );
