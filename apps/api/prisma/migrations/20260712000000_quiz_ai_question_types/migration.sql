-- Quiz: AI-graded question types, instructions & anti-cheat flags
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "gradingMode" TEXT NOT NULL DEFAULT 'EXACT';
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "pairs" JSONB;
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "blanks" JSONB;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "instructions" TEXT;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "preventMinimize" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "disableCopyPaste" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "resetOnMinimize" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quiz_answers" ADD COLUMN IF NOT EXISTS "awardedPercentage" DOUBLE PRECISION;
ALTER TABLE "quiz_answers" ADD COLUMN IF NOT EXISTS "aiFeedback" TEXT;
