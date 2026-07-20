-- A teacher whose profile is BOTH can legitimately teach the same class and
-- subject twice — once in the morning, once in the afternoon (e.g. a class
-- with no per-shift sections, where "shift" on the row is the only thing
-- telling the two slots apart). The old exact-duplicate key did not include
-- shift, so the second row was rejected as a false duplicate of the first.
--
-- COALESCE again, for the same reason as sectionId: two NULL-shift rows for
-- the same teacher/class/section/subject/year (a single-shift teacher, no
-- shift recorded) must still collide as a genuine duplicate. Substituting
-- 'BOTH' rather than casting to text: Postgres refuses an enum's text-output
-- function in an index expression ("functions in index expression must be
-- marked IMMUTABLE" — enum labels can theoretically be renamed, so the cast
-- is only STABLE). 'BOTH' works as the stand-in precisely because the CHECK
-- constraint above guarantees it can never be a real stored value here.
DROP INDEX IF EXISTS "teacher_assignments_exact_dup_key";

CREATE UNIQUE INDEX "teacher_assignments_exact_dup_key"
  ON "teacher_assignments" (
    "schoolId",
    "teacherId",
    "classId",
    (COALESCE("sectionId", '')),
    "subjectId",
    "academicYearId",
    (COALESCE("shift", 'BOTH'))
  );
