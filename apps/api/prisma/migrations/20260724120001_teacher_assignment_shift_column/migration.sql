-- Which shift a single assignment row is taught in. Nullable — only
-- meaningful for a teacher whose own profile is BOTH; a single-shift
-- teacher's assignments simply inherit their one shift without being asked.
ALTER TABLE "teacher_assignments" ADD COLUMN IF NOT EXISTS "shift" "Shift";

-- Never 'BOTH' itself — a slot is one class in one shift, so that value is
-- rejected at the database level, not just the API.
ALTER TABLE "teacher_assignments"
  ADD CONSTRAINT "teacher_assignments_shift_not_both"
  CHECK ("shift" IS NULL OR "shift" <> 'BOTH');
