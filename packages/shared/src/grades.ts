/** Default grade ladder provisioned once per academic year (12 grades). */
export const DEFAULT_GRADE_COUNT = 12;

export const DEFAULT_GRADE_NAMES = [
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

/** Trim and collapse internal whitespace for stable class/section names. */
export function normalizeAcademicName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Case-insensitive comparison key for duplicate detection. */
export function academicNameKey(name: string): string {
  return normalizeAcademicName(name).toLowerCase();
}
