-- Attendance shifts become their own standalone concept, decoupled from the
-- timetable module's SchoolShift/period-grid machinery — just a name (and
-- an informational daily time window) that a school can set up purely for
-- taking attendance, with its own management screen.

CREATE TABLE "attendance_shifts" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "attendance_shifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_shifts_schoolId_name_key" ON "attendance_shifts"("schoolId", "name");
CREATE INDEX "attendance_shifts_schoolId_idx" ON "attendance_shifts"("schoolId");

-- Repoint student_attendance.shiftId from school_shifts to attendance_shifts.
-- No production data references the old FK yet (this feature just shipped),
-- so this is a plain swap, not a data migration.
ALTER TABLE "student_attendance" DROP CONSTRAINT "student_attendance_shiftId_fkey";

ALTER TABLE "student_attendance"
  ADD CONSTRAINT "student_attendance_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "attendance_shifts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS, like every other tenant table.
ALTER TABLE "attendance_shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_shifts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_attendance_shifts ON "attendance_shifts"
    USING ("schoolId" = current_setting('app.current_tenant', true));
