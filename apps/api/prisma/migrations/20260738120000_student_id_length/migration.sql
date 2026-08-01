-- The "ID Length (padding)" field on Settings > Students has always existed
-- in the UI but was never wired to anything: not sent on save, and the code
-- allocator padded to a hardcoded 4 digits regardless. Default matches that
-- existing real behavior so no school's codes silently change shape.
ALTER TABLE "schools" ADD COLUMN "studentIdLength" INTEGER NOT NULL DEFAULT 4;
