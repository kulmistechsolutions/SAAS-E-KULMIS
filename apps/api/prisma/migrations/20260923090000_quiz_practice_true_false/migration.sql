-- True / False written, and a teacher trying their own paper.

-- The school's extra accepted words for a written True / False question,
-- per side: {"TRUE": ["sax"], "FALSE": ["khalad"]}. Null means only the
-- built-in true / صح / run and false / خطأ / been count, which is every
-- question that exists today.
ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "acceptedAnswers" JSONB;

-- A teacher's practice runs.
--
-- Deliberately not a kind of quiz_attempt. Every report, ranking, average,
-- pass rate, parent screen and copilot answer in the system reads
-- quiz_attempts; a practice row there would need every one of those queries
-- — and every one written after them — to remember to leave it out, and the
-- first that forgot would put a teacher's score into a class average. In a
-- table of its own there is nothing to forget: nothing that reports on
-- students can see it.
--
-- There is no student here at all, and no attempt count, so trying a paper
-- can never use up an attempt or lock a quiz as "already sat".
CREATE TABLE IF NOT EXISTS "quiz_practice_attempts" (
  "id"           TEXT NOT NULL,
  "schoolId"     TEXT NOT NULL,
  "quizId"       TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "username"     TEXT,
  "quizVersion"  TEXT,
  -- [{questionId, answer, isCorrect, marks, pending}]
  "answers"      JSONB NOT NULL,
  "score"        INTEGER NOT NULL DEFAULT 0,
  "totalMarks"   INTEGER NOT NULL DEFAULT 0,
  -- Marks on questions graded by AI or by hand for a real student, which a
  -- practice run does not spend a school's AI allowance on.
  "pendingMarks" INTEGER NOT NULL DEFAULT 0,
  "percentage"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grade"        TEXT,
  "result"       TEXT,
  "timeTakenSec" INTEGER NOT NULL DEFAULT 0,
  "submittedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_practice_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quiz_practice_attempts_quizId_submittedAt_idx"
  ON "quiz_practice_attempts" ("quizId", "submittedAt");
CREATE INDEX IF NOT EXISTS "quiz_practice_attempts_schoolId_idx"
  ON "quiz_practice_attempts" ("schoolId");

DO $$ BEGIN
  ALTER TABLE "quiz_practice_attempts"
    ADD CONSTRAINT "quiz_practice_attempts_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The school's own row-level isolation, like every other tenant table. A
-- table with a schoolId and no policy is readable across schools.
ALTER TABLE "quiz_practice_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_practice_attempts" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "quiz_practice_attempts_tenant_isolation" ON "quiz_practice_attempts"
    USING ("schoolId" = current_setting('app.current_tenant', true))
    WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "quiz_practice_attempts" TO app_user;
