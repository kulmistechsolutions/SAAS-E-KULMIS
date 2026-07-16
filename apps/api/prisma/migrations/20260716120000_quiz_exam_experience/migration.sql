-- Enhanced quiz exam experience: review/PDF flags, mark-for-review, activity timeline.

ALTER TABLE "quizzes"
  ADD COLUMN IF NOT EXISTS "allowReviewAnswers" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowPdfDownload" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "examinationRules" TEXT;

ALTER TABLE "quiz_attempts"
  ADD COLUMN IF NOT EXISTS "grade" TEXT,
  ADD COLUMN IF NOT EXISTS "teacherComment" TEXT;

ALTER TABLE "quiz_answers"
  ADD COLUMN IF NOT EXISTS "markedForReview" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "quiz_activity_events" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_activity_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quiz_activity_events_quizId_studentId_idx"
  ON "quiz_activity_events"("quizId", "studentId");
CREATE INDEX IF NOT EXISTS "quiz_activity_events_schoolId_idx"
  ON "quiz_activity_events"("schoolId");

DO $$ BEGIN
  ALTER TABLE "quiz_activity_events"
    ADD CONSTRAINT "quiz_activity_events_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "quiz_activity_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_activity_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_quiz_activity_events ON "quiz_activity_events";
CREATE POLICY tenant_isolation_quiz_activity_events ON "quiz_activity_events"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "quiz_activity_events" TO app_user;
