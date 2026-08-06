-- Attendance becomes shift-aware: a school running Morning/Afternoon shifts
-- can record one attendance row per student per shift per day, instead of
-- being locked to a single row per day. Schools with no shifts configured
-- keep the old "one record per day" behavior exactly (shiftId stays NULL).

ALTER TABLE "student_attendance" ADD COLUMN "shiftId" TEXT;

ALTER TABLE "student_attendance"
  ADD CONSTRAINT "student_attendance_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "school_shifts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Replace the old one-record-per-day unique index with a shift-aware one.
-- Postgres treats NULLs as distinct, so a plain (schoolId, studentId, date,
-- shiftId) unique index would silently allow duplicate rows for schools
-- that never set a shift. The partial index below closes that gap: it
-- enforces "one row per day" specifically for the shiftId IS NULL case,
-- exactly matching pre-shift behavior.
DROP INDEX "student_attendance_schoolId_studentId_date_key";

CREATE UNIQUE INDEX "student_attendance_schoolId_studentId_date_shiftId_key"
  ON "student_attendance"("schoolId", "studentId", "date", "shiftId");

CREATE UNIQUE INDEX "student_attendance_no_shift_key"
  ON "student_attendance"("schoolId", "studentId", "date")
  WHERE "shiftId" IS NULL;

CREATE INDEX "student_attendance_shiftId_idx" ON "student_attendance"("shiftId");
