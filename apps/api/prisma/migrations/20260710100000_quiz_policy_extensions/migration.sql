-- Quiz policy extensions: subject, schedule, settings, student portal password

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "portalPasswordHash" TEXT;

ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "passingMarks" INTEGER;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMP(3);
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3);
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "shuffleAnswers" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "showResultsImmediately" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "questionType" TEXT NOT NULL DEFAULT 'MCQ';
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "requiresManualGrade" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quiz_questions" ALTER COLUMN "correctAnswer" SET DEFAULT '';

CREATE INDEX IF NOT EXISTS "quizzes_teacherId_idx" ON "quizzes"("teacherId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_subjectId_fkey'
  ) THEN
    ALTER TABLE "quizzes"
      ADD CONSTRAINT "quizzes_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "subjects"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
