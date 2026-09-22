-- Formatting inside a question.
--
-- A tajwiid paper needs one letter of a word highlighted; a verse wants to be
-- set a size larger than the sentence asking about it. Schools were writing
-- those papers in Word and photographing them.
--
-- The formatted version sits beside the plain one rather than replacing it.
-- Everything except the screen uses the words: grading, the change history,
-- an export, a message to a parent. Keeping both is also what stops a teacher
-- making a word bold from counting as rewriting the question and retiring the
-- answers students had already given against it.
--
-- Null means there is no formatting and the plain text is the whole truth,
-- which is every question that exists today.
ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "questionHtml" TEXT,
  ADD COLUMN IF NOT EXISTS "optionsHtml" JSONB;

-- The instructions a student reads before starting are shown on their own
-- screen and want the same treatment.
ALTER TABLE "quizzes"
  ADD COLUMN IF NOT EXISTS "instructionsHtml" TEXT;
