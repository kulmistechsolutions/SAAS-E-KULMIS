-- What management asked the Copilot and what it answered. Kept so a school can
-- revisit an analysis, and so the daily allowance is counted from the same
-- rows rather than a separate tally that could drift from them.
CREATE TABLE "copilot_questions" (
  "id"        TEXT NOT NULL,
  "schoolId"  TEXT NOT NULL,
  "userId"    TEXT,
  "username"  TEXT,
  "question"  TEXT NOT NULL,
  "answer"    TEXT NOT NULL,
  "snapshot"  JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "copilot_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "copilot_questions_schoolId_createdAt_idx"
  ON "copilot_questions"("schoolId", "createdAt");

-- Same tenant isolation every other school-scoped table has.
ALTER TABLE "copilot_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "copilot_questions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_copilot_questions" ON "copilot_questions"
  USING ("schoolId" = current_setting('app.current_tenant', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "copilot_questions" TO app_user;
