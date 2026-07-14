"use client";

import { api } from "@/lib/api";
import type { EntityStatus } from "./types";

// ── Raw API shapes (ID-based, from the NestJS academics module) ──
export interface ApiYear {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}
export interface ApiClass {
  id: string;
  name: string;
  academicYearId: string;
  orderIndex: number;
  hasSections: boolean;
  notes: string | null;
  status: EntityStatus;
  createdAt: string;
}
export interface ApiSection {
  id: string;
  name: string;
  classId: string;
  status: EntityStatus;
  createdAt: string;
}
export interface ApiSubject {
  id: string;
  name: string;
  code: string | null;
  status: EntityStatus;
  createdAt: string;
}
export interface ApiClassSubject {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  createdAt: string;
}

// ── Reads ──
export const apiListYears = () => api<ApiYear[]>("/academic-years");
export const apiListClasses = (academicYearId?: string) =>
  api<ApiClass[]>(
    academicYearId ? `/classes?academicYearId=${encodeURIComponent(academicYearId)}` : "/classes",
  );
export const apiListSections = () => api<ApiSection[]>("/sections");
export const apiListSubjects = () => api<ApiSubject[]>("/subjects");
export const apiListClassSubjects = () => api<ApiClassSubject[]>("/class-subjects");

// ── Academic years ──
export const apiCreateYear = (body: {
  name: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}) => api<ApiYear>("/academic-years", { method: "POST", body });

export const apiActivateYear = (id: string) =>
  api<ApiYear>(`/academic-years/${id}/activate`, { method: "POST" });

// ── Classes ──
export const apiCreateClass = (body: {
  academicYearId: string;
  name: string;
  hasSections?: boolean;
  notes?: string | null;
  status?: EntityStatus;
}) => api<ApiClass>("/classes", { method: "POST", body });

export const apiUpdateClass = (
  id: string,
  body: {
    name?: string;
    hasSections?: boolean;
    notes?: string | null;
    status?: EntityStatus;
  },
) => api<ApiClass>(`/classes/${id}`, { method: "PATCH", body });

export const apiDeleteClass = (id: string) =>
  api(`/classes/${id}`, { method: "DELETE" });

export const apiRepairClassStructure = (academicYearId?: string) =>
  api<{ academicYearId: string; classesCreated: number; classesMerged: number }>(
    academicYearId
      ? `/classes/structure/repair?academicYearId=${encodeURIComponent(academicYearId)}`
      : "/classes/structure/repair",
    { method: "POST" },
  );

// ── Sections ──
export const apiCreateSection = (body: {
  classId: string;
  name: string;
  status?: EntityStatus;
}) => api<ApiSection>("/sections", { method: "POST", body });

export const apiUpdateSection = (
  id: string,
  body: { name?: string; status?: EntityStatus },
) => api<ApiSection>(`/sections/${id}`, { method: "PATCH", body });

export const apiDeleteSection = (id: string) =>
  api(`/sections/${id}`, { method: "DELETE" });

// ── Subjects ──
export const apiCreateSubject = (body: {
  name: string;
  code?: string | null;
  status?: EntityStatus;
}) => api<ApiSubject>("/subjects", { method: "POST", body });

export const apiUpdateSubject = (
  id: string,
  body: { name?: string; code?: string | null; status?: EntityStatus },
) => api<ApiSubject>(`/subjects/${id}`, { method: "PATCH", body });

export const apiDeleteSubject = (id: string) =>
  api(`/subjects/${id}`, { method: "DELETE" });

// ── Class ↔ Subject ──
export const apiCreateClassSubject = (body: {
  academicYearId: string;
  classId: string;
  sectionId?: string | null;
  subjectId: string;
}) => api<ApiClassSubject>("/class-subjects", { method: "POST", body });

export const apiDeleteClassSubject = (id: string) =>
  api(`/class-subjects/${id}`, { method: "DELETE" });
