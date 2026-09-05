-- An extra fee aimed at one named child.
--
-- Extra fees could reach the whole school or a chosen set of classes, but not
-- a single student — so a resit paper, a replaced textbook, or a trip only one
-- child went on had nowhere to be billed. Schools were charging those by
-- inventing a one-class fee, or not charging them at all.
--
-- Nullable and additive: every existing extra fee keeps behaving exactly as it
-- did, since a null here means "this was never a single-student fee".

ALTER TABLE "extra_fees" ADD COLUMN "studentId" TEXT;

CREATE INDEX "extra_fees_studentId_idx" ON "extra_fees"("studentId");
