-- A question a student has answered is part of an academic record.
--
-- Editing a published quiz deleted every question row and recreated them with
-- new ids. Answers are stored against question ids and have no foreign key, so
-- the attempt kept its score while its answer sheet pointed at questions that
-- no longer existed. Ninety-four answers across eleven attempts at four
-- schools are already in that state: the marks survive, the paper they were
-- given for does not.
--
-- `retiredAt` is how a question leaves a quiz from now on: taken off the paper,
-- kept on the record. A question nobody has answered is still deleted outright
-- — a draft being tidied should not accumulate ghosts.
ALTER TABLE "quiz_questions" ADD COLUMN IF NOT EXISTS "retiredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "quiz_questions_quizId_retiredAt_idx"
  ON "quiz_questions" ("quizId", "retiredAt");
