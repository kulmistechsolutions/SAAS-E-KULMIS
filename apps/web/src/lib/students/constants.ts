export const STUDENT_PREFIX = "SHMM";
export const PARENT_PREFIX = "PSHMM";

/** @deprecated Use `useAcademicYearSelect()` or `activeAcademicYear()` from `@/lib/academics/store` */
export const ACADEMIC_YEARS = ["2024-2025", "2023-2024", "2022-2023"] as const;
/** @deprecated Use `activeAcademicYear()` from `@/lib/academics/store` */
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

export const DEFAULT_MONTHLY_FEE = 50;

export function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Zero-padded ID formatter, e.g. code("SHMM", 1) -> "SHMM000001". */
export function code(prefix: string, seq: number): string {
  return `${prefix}${String(seq).padStart(6, "0")}`;
}
