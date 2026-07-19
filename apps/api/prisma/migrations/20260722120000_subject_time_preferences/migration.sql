-- Soft wishes about when a subject should fall ("Maths in the morning").
--
-- Kept apart from teacher_unavailability, which is a hard rule enforced by the
-- solver. A preference only reorders the solver's choices and can never make a
-- week unsolvable — a school must not lose its whole timetable to a nice-to-have.

CREATE TABLE IF NOT EXISTS "subject_time_preferences" (
  "id"             TEXT NOT NULL,
  "schoolId"       TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "subjectId"      TEXT NOT NULL,
  -- NULL applies the preference to every class taking this subject.
  "classId"        TEXT,
  "startMinute"    INTEGER NOT NULL,
  "endMinute"      INTEGER NOT NULL,
  -- The sentence the admin approved, so the rule stays explainable later.
  "note"           TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subject_time_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subject_time_preferences_time_valid" CHECK (
    "startMinute" >= 0 AND "endMinute" > "startMinute" AND "endMinute" <= 1440
  )
);

CREATE INDEX IF NOT EXISTS "subject_time_preferences_schoolId_idx"
  ON "subject_time_preferences" ("schoolId");
CREATE INDEX IF NOT EXISTS "subject_time_preferences_scope_idx"
  ON "subject_time_preferences" ("schoolId", "academicYearId");

-- One preference per subject per scope; COALESCE because a NULL classId would
-- otherwise let the same school-wide wish be stored over and over.
CREATE UNIQUE INDEX IF NOT EXISTS "subject_time_preferences_scope_key"
  ON "subject_time_preferences" (
    "schoolId", "academicYearId", "subjectId", COALESCE("classId", '')
  );

ALTER TABLE "subject_time_preferences"
  ADD CONSTRAINT "subject_time_preferences_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_time_preferences"
  ADD CONSTRAINT "subject_time_preferences_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_time_preferences"
  ADD CONSTRAINT "subject_time_preferences_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (tenant isolation).
ALTER TABLE "subject_time_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subject_time_preferences" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subject_time_preferences ON "subject_time_preferences"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "subject_time_preferences" TO app_user;
