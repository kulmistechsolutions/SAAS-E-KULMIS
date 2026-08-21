-- Teacher shifts move off the fixed MORNING/AFTERNOON "Shift" enum onto
-- AttendanceShift — a school's own permanent, named shift list (already used
-- for student attendance) — so a school can run any number of shifts and a
-- teacher can be assigned to any combination of them. TeacherAssignment and
-- TeacherAttendance move onto the same reference. TeacherAttendance also
-- becomes properly per-shift: a teacher who works more than one shift in a
-- day can now be marked present in one and absent in another, mirroring
-- StudentAttendance.
--
-- Every step below backfills existing data before dropping the old columns,
-- so no history is lost.

-- 1. Every school with a teacher/assignment/attendance row tagged MORNING or
-- AFTERNOON gets a real "Morning"/"Afternoon" AttendanceShift row to point
-- at — reusing one that already exists (e.g. the school already set up
-- Attendance Shift Management) rather than creating a duplicate.
INSERT INTO "attendance_shifts" ("id", "schoolId", "name", "orderIndex", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."schoolId", s."label",
  CASE WHEN s."label" = 'Morning' THEN 0 ELSE 1 END, 'ACTIVE', now(), now()
FROM (
  SELECT DISTINCT "schoolId", 'Morning' AS "label" FROM "teachers" WHERE 'MORNING' = ANY("shifts")
  UNION
  SELECT DISTINCT "schoolId", 'Afternoon' FROM "teachers" WHERE 'AFTERNOON' = ANY("shifts")
  UNION
  SELECT DISTINCT "schoolId", 'Morning' FROM "teacher_assignments" WHERE "shift" = 'MORNING'
  UNION
  SELECT DISTINCT "schoolId", 'Afternoon' FROM "teacher_assignments" WHERE "shift" = 'AFTERNOON'
  UNION
  SELECT DISTINCT "schoolId", 'Morning' FROM "teacher_attendance" WHERE "shift" IN ('MORNING', 'BOTH')
  UNION
  SELECT DISTINCT "schoolId", 'Afternoon' FROM "teacher_attendance" WHERE "shift" IN ('AFTERNOON', 'BOTH')
) s
WHERE NOT EXISTS (
  SELECT 1 FROM "attendance_shifts" a WHERE a."schoolId" = s."schoolId" AND a."name" = s."label"
);

-- 2. Teacher <-> AttendanceShift join table, replacing Teacher.shifts.
CREATE TABLE "teacher_shifts" (
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,

  CONSTRAINT "teacher_shifts_pkey" PRIMARY KEY ("teacherId", "shiftId")
);

CREATE INDEX "teacher_shifts_schoolId_idx" ON "teacher_shifts"("schoolId");
CREATE INDEX "teacher_shifts_shiftId_idx" ON "teacher_shifts"("shiftId");

ALTER TABLE "teacher_shifts"
  ADD CONSTRAINT "teacher_shifts_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_shifts"
  ADD CONSTRAINT "teacher_shifts_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "attendance_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "teacher_shifts" ("schoolId", "teacherId", "shiftId")
SELECT t."schoolId", t."id", a."id"
FROM "teachers" t
JOIN "attendance_shifts" a ON a."schoolId" = t."schoolId" AND a."name" = 'Morning'
WHERE 'MORNING' = ANY(t."shifts")
UNION
SELECT t."schoolId", t."id", a."id"
FROM "teachers" t
JOIN "attendance_shifts" a ON a."schoolId" = t."schoolId" AND a."name" = 'Afternoon'
WHERE 'AFTERNOON' = ANY(t."shifts");

ALTER TABLE "teachers" DROP COLUMN "shifts";

ALTER TABLE "teacher_shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_shifts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_teacher_shifts ON "teacher_shifts"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

-- 3. TeacherAssignment.shift (enum) -> shiftId (AttendanceShift reference).
ALTER TABLE "teacher_assignments" ADD COLUMN "shiftId" TEXT;

UPDATE "teacher_assignments" ta
SET "shiftId" = a."id"
FROM "attendance_shifts" a
WHERE a."schoolId" = ta."schoolId"
  AND a."name" = (CASE ta."shift" WHEN 'MORNING' THEN 'Morning' WHEN 'AFTERNOON' THEN 'Afternoon' END)
  AND ta."shift" IS NOT NULL;

ALTER TABLE "teacher_assignments" DROP CONSTRAINT "teacher_assignments_shift_not_both";
DROP INDEX IF EXISTS "teacher_assignments_exact_dup_key";
ALTER TABLE "teacher_assignments" DROP COLUMN "shift";

ALTER TABLE "teacher_assignments"
  ADD CONSTRAINT "teacher_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "attendance_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "teacher_assignments_shiftId_idx" ON "teacher_assignments"("shiftId");

-- Same exact-duplicate key as before (see teacher_assignment_shift_in_dup_key
-- migration), now over a plain text shiftId rather than an enum, so the
-- earlier 'BOTH'-as-stand-in workaround is no longer needed.
CREATE UNIQUE INDEX "teacher_assignments_exact_dup_key"
  ON "teacher_assignments" (
    "schoolId",
    "teacherId",
    "classId",
    (COALESCE("sectionId", '')),
    "subjectId",
    "academicYearId",
    (COALESCE("shiftId", ''))
  );

-- 4. TeacherAttendance.shift (enum, one row per teacher per day) -> shiftId
-- (AttendanceShift reference, one row per teacher per day PER SHIFT).
ALTER TABLE "teacher_attendance" ADD COLUMN "shiftId" TEXT;

UPDATE "teacher_attendance" ta
SET "shiftId" = a."id"
FROM "attendance_shifts" a
WHERE a."schoolId" = ta."schoolId"
  AND a."name" = (CASE WHEN ta."shift" = 'AFTERNOON' THEN 'Afternoon' ELSE 'Morning' END);

DROP INDEX "teacher_attendance_schoolId_teacherId_date_key";
ALTER TABLE "teacher_attendance" DROP COLUMN "shift";

ALTER TABLE "teacher_attendance"
  ADD CONSTRAINT "teacher_attendance_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "attendance_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "teacher_attendance_schoolId_teacherId_date_shiftId_key"
  ON "teacher_attendance"("schoolId", "teacherId", "date", "shiftId");

-- 5. The old fixed 2-value enum is no longer referenced anywhere.
DROP TYPE "Shift";
