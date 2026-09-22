-- Arabic, and the direction it runs in.
--
-- A teacher typing "ما هي عاصمة الصومال؟" should not have to find a setting
-- to make it read right-to-left; the screen can see that it is Arabic. So the
-- default is AUTO and detection does the work. The override exists because a
-- question can be mostly English with an Arabic quotation in it, or the
-- reverse, and only the teacher knows which way the sentence is meant to run.
--
-- Per question as well as per quiz, because a single paper legitimately mixes
-- them: question 1 English, question 2 Arabic. Null on a question means "as
-- the quiz says", which is what almost every question will want.
ALTER TABLE "quizzes"
  ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS "direction" TEXT NOT NULL DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS "contentFont" TEXT;

ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "direction" TEXT,
  ADD COLUMN IF NOT EXISTS "contentFont" TEXT;
