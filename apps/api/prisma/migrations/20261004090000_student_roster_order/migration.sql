-- A student's place in their class register.
--
-- The S/N a school reads is a student's position in their class, counted in
-- the order they joined it: the first registered is 1, the next 2, and a new
-- student goes to the end. The list used to number its rows as it happened
-- to sort them — newest first by default — so registering a sixth student
-- made the newcomer 1 and moved everybody else down.
--
-- rosterAt is the moment the student took their place in their current
-- class. The S/N is their rank by it within the class, so deleting a student
-- closes the gap behind them, and a student who replaces a deleted one can
-- take the same place by taking the same moment. It is not registrationDate:
-- that is a fact about the student shown to the school and must not be
-- rewritten to move someone in a list.
--
-- Backfilled from createdAt — the order students were entered, which is also
-- the order their IDs were issued. registrationDate equals createdAt for
-- every student in production today.
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "rosterAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "students" SET "rosterAt" = "createdAt";

CREATE INDEX IF NOT EXISTS "students_classId_rosterAt_idx"
  ON "students" ("classId", "rosterAt");
