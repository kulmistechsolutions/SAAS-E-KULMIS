-- A published quiz is an academic record, so changing it has to say which
-- change it is.
--
-- A typo is not the same event as rewriting question 5, and the difference
-- decides what a student who already sat the paper should be shown. Correcting
-- spelling in place is right — they sat that question, only misspelt. Changing
-- what the question asks is not: their answer was to the old one.
--
-- So a quiz carries a version, an attempt records the version it was started
-- on, and every change is written down with who made it and why.
ALTER TABLE "quizzes"
  ADD COLUMN IF NOT EXISTS "version" TEXT NOT NULL DEFAULT '1.0';

-- Null for every attempt taken before this existed: unknowable, and saying so
-- is better than back-filling a version they may not have sat.
ALTER TABLE "quiz_attempts"
  ADD COLUMN IF NOT EXISTS "quizVersion" TEXT;

CREATE TABLE IF NOT EXISTS "quiz_version_changes" (
  "id"              TEXT NOT NULL,
  "schoolId"        TEXT NOT NULL,
  "quizId"          TEXT NOT NULL,
  "version"         TEXT NOT NULL,
  -- CORRECTION | NEW_VERSION | PUBLISH | CLOSE | ARCHIVE | REOPEN
  "action"          TEXT NOT NULL,
  "summary"         TEXT NOT NULL,
  "reason"          TEXT,
  "details"         JSONB,
  "changedByUserId" TEXT,
  "changedByName"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_version_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quiz_version_changes_quizId_createdAt_idx"
  ON "quiz_version_changes" ("quizId", "createdAt");
CREATE INDEX IF NOT EXISTS "quiz_version_changes_schoolId_idx"
  ON "quiz_version_changes" ("schoolId");

DO $$ BEGIN
  ALTER TABLE "quiz_version_changes"
    ADD CONSTRAINT "quiz_version_changes_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The school's own row-level isolation, like every other tenant table.
ALTER TABLE "quiz_version_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_version_changes" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "quiz_version_changes_tenant_isolation" ON "quiz_version_changes"
    USING ("schoolId" = current_setting('app.current_tenant', true))
    WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Default privileges already cover a table created by this owner; stated
-- explicitly so the grant does not depend on who ran the migration.
GRANT SELECT, INSERT, UPDATE, DELETE ON "quiz_version_changes" TO app_user;
