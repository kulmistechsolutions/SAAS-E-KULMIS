export const TEACHER_PREFIX = "TSHMM";

export const ACADEMIC_YEARS = ["2024-2025", "2023-2024", "2022-2023"] as const;
export const ACTIVE_ACADEMIC_YEAR = ACADEMIC_YEARS[0];

export const CLASSES = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
] as const;

export const SECTIONS = ["A", "B", "C"] as const;

export const SUBJECTS = [
  "Mathematics",
  "English",
  "Science",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Islamic Studies",
  "Arabic",
  "Computer Science",
  "Physical Education",
] as const;

export const DEFAULT_SALARY = 450;

export const DEFAULT_TEACHER_PASSWORD = "12345";

export function teacherCode(seq: number): string {
  return `${TEACHER_PREFIX}${String(seq).padStart(6, "0")}`;
}

export function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

import { SCHOOL as BRAND_SCHOOL } from "@/lib/brand";

export const SCHOOL = BRAND_SCHOOL;
