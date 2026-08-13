import type { Prisma } from "@prisma/client";

/**
 * A student sits in one home class (Student.classId) and, optionally, any
 * number of additional ones (StudentClassEnrollment). Everything that asks
 * "who is in class X" — rosters, attendance, exams, quizzes — must look at
 * both, while the student stays a single record.
 *
 * Deliberately NOT used by fee generation, promotion or year transfer: those
 * key off the home class alone, so a student in two classes is still billed
 * and promoted once.
 */

/**
 * `sectionId` is three-valued on purpose, matching how callers already use it:
 * `undefined` = don't filter by section at all, `null` = only students with no
 * section (a class that isn't split), a string = that one section.
 */
export function studentInClassWhere(
  classId?: string,
  sectionId?: string | null,
): Prisma.StudentWhereInput {
  const sectionFilter = sectionId === undefined ? {} : { sectionId };
  if (!classId) return sectionFilter;
  return {
    OR: [
      { classId, ...sectionFilter },
      { extraClasses: { some: { classId, ...sectionFilter } } },
    ],
  };
}

/**
 * In-memory twin of {@link studentInClassWhere}, for code that has already
 * loaded students (with `extraClasses`) and is filtering them in JS.
 */
export function studentSitsIn(
  student: {
    classId: string;
    sectionId: string | null;
    extraClasses?: { classId: string; sectionId: string | null }[];
  },
  classId: string,
  sectionId?: string | null,
): boolean {
  const seats = [
    { classId: student.classId, sectionId: student.sectionId },
    ...(student.extraClasses ?? []),
  ];
  return seats.some(
    (s) =>
      s.classId === classId &&
      (sectionId === undefined || s.sectionId === sectionId),
  );
}
