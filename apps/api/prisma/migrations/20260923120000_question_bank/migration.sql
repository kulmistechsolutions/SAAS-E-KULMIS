-- The school's question bank.
--
-- Questions written once and used again: next term, in another section, in
-- the end-of-year paper. A bank question is copied into a quiz, never linked,
-- so editing it here afterwards cannot reach into a paper students have
-- already sat. A published quiz is an academic record.
--
-- The question columns mirror quiz_questions, so a question moves between
-- the two without anything being lost or translated.
CREATE TABLE IF NOT EXISTS "question_bank_items" (
  "id"              TEXT NOT NULL,
  "schoolId"        TEXT NOT NULL,
  -- The teacher it belongs to, when a teacher wrote it; null when an
  -- administrator did. Teachers edit only their own.
  "teacherId"       TEXT,
  "createdByUserId" TEXT,
  "createdByName"   TEXT,
  "subjectId"       TEXT,
  "classId"         TEXT,
  "academicYearId"  TEXT,
  "topic"           TEXT,
  -- EASY | MEDIUM | HARD
  "difficulty"      TEXT NOT NULL DEFAULT 'MEDIUM',
  -- AUTO | so | en | ar
  "language"        TEXT NOT NULL DEFAULT 'AUTO',
  "shared"          BOOLEAN NOT NULL DEFAULT true,
  "question"        TEXT NOT NULL,
  "questionHtml"    TEXT,
  "questionType"    TEXT NOT NULL DEFAULT 'MCQ',
  "options"         JSONB NOT NULL DEFAULT '[]',
  "optionsHtml"     JSONB,
  "correctAnswer"   TEXT NOT NULL DEFAULT '',
  "gradingMode"     TEXT NOT NULL DEFAULT 'EXACT',
  "pairs"           JSONB,
  "blanks"          JSONB,
  "acceptedAnswers" JSONB,
  "marks"           INTEGER NOT NULL DEFAULT 1,
  "direction"       TEXT,
  "contentFont"     TEXT,
  "usageCount"      INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt"      TIMESTAMP(3),
  -- Taken out of the bank. Kept, because "where did this question come
  -- from" is a fair thing to ask of a paper after the fact.
  "archivedAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_bank_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "question_bank_items_schoolId_archivedAt_idx"
  ON "question_bank_items" ("schoolId", "archivedAt");
CREATE INDEX IF NOT EXISTS "question_bank_items_schoolId_subjectId_idx"
  ON "question_bank_items" ("schoolId", "subjectId");
CREATE INDEX IF NOT EXISTS "question_bank_items_schoolId_teacherId_idx"
  ON "question_bank_items" ("schoolId", "teacherId");

-- The school's own row-level isolation, like every other tenant table. A
-- table with a schoolId and no policy is readable across schools.
ALTER TABLE "question_bank_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_bank_items" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "question_bank_items_tenant_isolation" ON "question_bank_items"
    USING ("schoolId" = current_setting('app.current_tenant', true))
    WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "question_bank_items" TO app_user;
