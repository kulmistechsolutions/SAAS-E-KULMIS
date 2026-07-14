-- Fix exact-duplicate uniqueness for teacher assignments.
-- PostgreSQL UNIQUE treats NULLs as distinct, so two rows with sectionId IS NULL
-- and the same teacher/class/subject/year could both be inserted. COALESCE makes
-- "all sections" (NULL) participate in the unique key correctly.
-- Duplicate = same Teacher + Year + Class + Section + Subject only.

DROP INDEX IF EXISTS "teacher_assignments_schoolId_teacherId_classId_sectionId_su_key";

CREATE UNIQUE INDEX "teacher_assignments_exact_dup_key"
  ON "teacher_assignments" (
    "schoolId",
    "teacherId",
    "classId",
    (COALESCE("sectionId", '')),
    "subjectId",
    "academicYearId"
  );
