-- Timetable (Module 12) — Phase 1: data model + the anti-clash guarantees.
--
-- The whole point of this migration is the last section. A generator can have
-- bugs; a hand edit in the admin UI can be wrong; two people can publish at the
-- same moment. So "one teacher is never in two rooms at once" is enforced by
-- PostgreSQL itself, on wall-clock time, ACROSS shifts — not by application code.

-- 1. btree_gist gives GiST indexes the `=` operator for scalar columns, which
--    the exclusion constraints below need alongside the range overlap operator.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Shifts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "school_shifts" (
  "id"             TEXT NOT NULL,
  "schoolId"       TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "orderIndex"     INTEGER NOT NULL DEFAULT 0,
  -- JS getDay() numbers: 0 = Sunday … 6 = Saturday. [6,0,1,2,3] = Sat–Wed.
  "days"           INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "status"         "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_shifts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_shifts_school_year_name_key"
  ON "school_shifts" ("schoolId", "academicYearId", "name");
CREATE INDEX IF NOT EXISTS "school_shifts_schoolId_idx" ON "school_shifts" ("schoolId");
CREATE INDEX IF NOT EXISTS "school_shifts_academicYearId_idx" ON "school_shifts" ("academicYearId");

ALTER TABLE "school_shifts"
  ADD CONSTRAINT "school_shifts_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Period grid ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "shift_periods" (
  "id"          TEXT NOT NULL,
  "schoolId"    TEXT NOT NULL,
  "shiftId"     TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "orderIndex"  INTEGER NOT NULL,
  -- Minutes from midnight. 07:50 = 470. Exact, timezone-free, and directly
  -- comparable between shifts.
  "startMinute" INTEGER NOT NULL,
  "endMinute"   INTEGER NOT NULL,
  "isBreak"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shift_periods_pkey" PRIMARY KEY ("id"),
  -- A period that ends before it starts would silently corrupt every overlap
  -- check that follows, so reject it at the source.
  CONSTRAINT "shift_periods_time_valid" CHECK (
    "startMinute" >= 0 AND "endMinute" > "startMinute" AND "endMinute" <= 1440
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS "shift_periods_shift_order_key"
  ON "shift_periods" ("schoolId", "shiftId", "orderIndex");
CREATE INDEX IF NOT EXISTS "shift_periods_schoolId_idx" ON "shift_periods" ("schoolId");
CREATE INDEX IF NOT EXISTS "shift_periods_shiftId_idx" ON "shift_periods" ("shiftId");

ALTER TABLE "shift_periods"
  ADD CONSTRAINT "shift_periods_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "school_shifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Periods within one shift may not overlap each other either.
ALTER TABLE "shift_periods"
  ADD CONSTRAINT "shift_periods_no_overlap"
  EXCLUDE USING gist (
    "shiftId" WITH =,
    int4range("startMinute", "endMinute") WITH &&
  );

-- ── Lesson allocation (how many periods a subject gets per week) ────────────

CREATE TABLE IF NOT EXISTS "subject_loads" (
  "id"             TEXT NOT NULL,
  "schoolId"       TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId"        TEXT NOT NULL,
  "sectionId"      TEXT,
  "subjectId"      TEXT NOT NULL,
  "periodsPerWeek" INTEGER NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subject_loads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subject_loads_count_valid" CHECK ("periodsPerWeek" >= 0 AND "periodsPerWeek" <= 60)
);
-- COALESCE, not a plain multi-column unique: PostgreSQL treats NULLs as
-- distinct, so a nullable sectionId would let the same class+subject be
-- inserted twice at whole-class level and quietly double its weekly count.
CREATE UNIQUE INDEX IF NOT EXISTS "subject_loads_classroom_subject_key"
  ON "subject_loads" ("schoolId", "academicYearId", "classId", COALESCE("sectionId", ''), "subjectId");
CREATE INDEX IF NOT EXISTS "subject_loads_schoolId_idx" ON "subject_loads" ("schoolId");
CREATE INDEX IF NOT EXISTS "subject_loads_lookup_idx"
  ON "subject_loads" ("schoolId", "academicYearId", "classId");

ALTER TABLE "subject_loads"
  ADD CONSTRAINT "subject_loads_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_loads"
  ADD CONSTRAINT "subject_loads_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_loads"
  ADD CONSTRAINT "subject_loads_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_loads"
  ADD CONSTRAINT "subject_loads_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Teacher unavailability ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "teacher_unavailability" (
  "id"          TEXT NOT NULL,
  "schoolId"    TEXT NOT NULL,
  "teacherId"   TEXT NOT NULL,
  "dayOfWeek"   INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute"   INTEGER NOT NULL,
  "reason"      TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teacher_unavailability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "teacher_unavailability_day_valid" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  CONSTRAINT "teacher_unavailability_time_valid" CHECK (
    "startMinute" >= 0 AND "endMinute" > "startMinute" AND "endMinute" <= 1440
  )
);
CREATE INDEX IF NOT EXISTS "teacher_unavailability_schoolId_idx" ON "teacher_unavailability" ("schoolId");
CREATE INDEX IF NOT EXISTS "teacher_unavailability_teacher_idx"
  ON "teacher_unavailability" ("schoolId", "teacherId");

ALTER TABLE "teacher_unavailability"
  ADD CONSTRAINT "teacher_unavailability_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "teachers" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Timetables ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "TimetableStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "timetables" (
  "id"             TEXT NOT NULL,
  "schoolId"       TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "shiftId"        TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "status"         "TimetableStatus" NOT NULL DEFAULT 'DRAFT',
  "generatedAt"    TIMESTAMP(3),
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timetables_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "timetables_schoolId_idx" ON "timetables" ("schoolId");
CREATE INDEX IF NOT EXISTS "timetables_scope_idx"
  ON "timetables" ("schoolId", "academicYearId", "shiftId");

ALTER TABLE "timetables"
  ADD CONSTRAINT "timetables_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetables"
  ADD CONSTRAINT "timetables_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "school_shifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "timetable_entries" (
  "id"            TEXT NOT NULL,
  "schoolId"      TEXT NOT NULL,
  "timetableId"   TEXT NOT NULL,
  "classId"       TEXT NOT NULL,
  "sectionId"     TEXT,
  "subjectId"     TEXT NOT NULL,
  "teacherId"     TEXT,
  "shiftPeriodId" TEXT NOT NULL,
  "dayOfWeek"     INTEGER NOT NULL,
  "startMinute"   INTEGER NOT NULL,
  "endMinute"     INTEGER NOT NULL,
  "isActive"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timetable_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "timetable_entries_day_valid" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  CONSTRAINT "timetable_entries_time_valid" CHECK (
    "startMinute" >= 0 AND "endMinute" > "startMinute" AND "endMinute" <= 1440
  )
);
CREATE INDEX IF NOT EXISTS "timetable_entries_schoolId_idx" ON "timetable_entries" ("schoolId");
CREATE INDEX IF NOT EXISTS "timetable_entries_timetableId_idx" ON "timetable_entries" ("timetableId");
CREATE INDEX IF NOT EXISTS "timetable_entries_teacher_day_idx"
  ON "timetable_entries" ("schoolId", "teacherId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "timetable_entries_class_day_idx"
  ON "timetable_entries" ("timetableId", "classId", "sectionId", "dayOfWeek");

ALTER TABLE "timetable_entries"
  ADD CONSTRAINT "timetable_entries_timetableId_fkey"
  FOREIGN KEY ("timetableId") REFERENCES "timetables" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_entries"
  ADD CONSTRAINT "timetable_entries_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_entries"
  ADD CONSTRAINT "timetable_entries_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_entries"
  ADD CONSTRAINT "timetable_entries_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SET NULL, not CASCADE: if a teacher leaves mid-year the lesson must stay on
-- the timetable as an unstaffed slot the school can see and fill, not vanish.
ALTER TABLE "timetable_entries"
  ADD CONSTRAINT "timetable_entries_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "teachers" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timetable_entries"
  ADD CONSTRAINT "timetable_entries_shiftPeriodId_fkey"
  FOREIGN KEY ("shiftPeriodId") REFERENCES "shift_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── The anti-clash guarantees ──────────────────────────────────────────────
--
-- Everything above is bookkeeping. These three are the promise.

-- (a) One classroom cannot hold two lessons in the same slot of one timetable.
--     COALESCE again, so a whole-class row and a section row cannot both claim
--     the slot through a NULL.
CREATE UNIQUE INDEX IF NOT EXISTS "timetable_entries_one_lesson_per_slot"
  ON "timetable_entries" (
    "timetableId", "classId", COALESCE("sectionId", ''), "dayOfWeek", "shiftPeriodId"
  );

-- (b) A teacher is never in two places at the same moment. Compared on
--     wall-clock minutes, so this holds ACROSS shifts: a morning lesson running
--     11:30–12:00 and an afternoon one at 11:45–12:15 collide and are rejected,
--     even though neither shift's own grid has a conflict.
--     Scoped to isActive so unpublished drafts can be edited freely.
ALTER TABLE "timetable_entries"
  ADD CONSTRAINT "timetable_entries_teacher_no_overlap"
  EXCLUDE USING gist (
    "schoolId" WITH =,
    "teacherId" WITH =,
    "dayOfWeek" WITH =,
    int4range("startMinute", "endMinute") WITH &&
  ) WHERE ("isActive" AND "teacherId" IS NOT NULL);

-- (c) The same, for the classroom: a section cannot be taught two things at
--     once even if the two lessons come from different shifts or timetables.
ALTER TABLE "timetable_entries"
  ADD CONSTRAINT "timetable_entries_class_no_overlap"
  EXCLUDE USING gist (
    "schoolId" WITH =,
    "classId" WITH =,
    (COALESCE("sectionId", '')) WITH =,
    "dayOfWeek" WITH =,
    int4range("startMinute", "endMinute") WITH &&
  ) WHERE ("isActive");

-- ── Shift membership on the classroom ──────────────────────────────────────
-- On both: a section overrides its class, so 8A can attend in the morning and
-- 8B in the afternoon.
ALTER TABLE "classes"  ADD COLUMN IF NOT EXISTS "shiftId" TEXT;
ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "shiftId" TEXT;

ALTER TABLE "classes"
  ADD CONSTRAINT "classes_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "school_shifts" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sections"
  ADD CONSTRAINT "sections_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "school_shifts" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Row-Level Security (tenant isolation) ──────────────────────────────────

ALTER TABLE "school_shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school_shifts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_school_shifts ON "school_shifts"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "school_shifts" TO app_user;

ALTER TABLE "shift_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shift_periods" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_shift_periods ON "shift_periods"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "shift_periods" TO app_user;

ALTER TABLE "subject_loads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subject_loads" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subject_loads ON "subject_loads"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "subject_loads" TO app_user;

ALTER TABLE "teacher_unavailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_unavailability" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_teacher_unavailability ON "teacher_unavailability"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "teacher_unavailability" TO app_user;

ALTER TABLE "timetables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "timetables" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_timetables ON "timetables"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "timetables" TO app_user;

ALTER TABLE "timetable_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "timetable_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_timetable_entries ON "timetable_entries"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "timetable_entries" TO app_user;
