"use client";

import { api } from "@/lib/api";

export interface ApiPromotionRecord {
  id: string;
  studentId: string;
  academicYearId: string;
  type: "INDIVIDUAL" | "CLASS" | "SCHOOL_WIDE";
  fromClassId: string;
  fromSectionId: string | null;
  toClassId: string | null;
  toSectionId: string | null;
  graduated: boolean;
  promotedAt: string;
  promotedByUserId: string | null;
  student: {
    code: string;
    fullName: string;
    class: { name: string };
    section: { name: string } | null;
  };
}

export interface ApiGraduatedStudent {
  id: string;
  code: string;
  fullName: string;
  parentId: string;
  updatedAt: string;
  class: { name: string; academicYear: { name: string } | null };
  section: { name: string } | null;
}

export const apiPromotionHistory = (academicYearId?: string) =>
  api<ApiPromotionRecord[]>(
    `/promotions/history${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ""}`,
  );

export const apiGraduatedStudents = () => api<ApiGraduatedStudent[]>("/promotions/graduated");

export const apiPromoteStudent = (body: {
  studentId: string;
  academicYearId: string;
  toClassId?: string | null;
  toSectionId?: string | null;
  graduate?: boolean;
}) => api<ApiPromotionRecord>("/promotions/student", { method: "POST", body });

export const apiPromoteClass = (body: {
  academicYearId: string;
  fromClassId: string;
  fromSectionId?: string | null;
  toClassId?: string | null;
  toSectionId?: string | null;
  graduate?: boolean;
}) => api<{ promoted: number }>("/promotions/class", { method: "POST", body });

export const apiPromoteSchoolWide = (body: {
  academicYearId: string;
  graduate?: boolean;
}) => api<{ promoted: number }>("/promotions/school-wide", { method: "POST", body });
