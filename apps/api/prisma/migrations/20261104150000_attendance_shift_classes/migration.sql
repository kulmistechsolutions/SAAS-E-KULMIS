-- Several roll calls a day: each attendance shift can name the classes that
-- take it and lock at its own hour. Nothing existing changes: no shift has
-- classes listed, so every shift is still taken by every class.
ALTER TABLE "attendance_shifts" ADD COLUMN "lockTime" TEXT;

CREATE TABLE "class_attendance_shifts" (
  "id"        TEXT NOT NULL,
  "schoolId"  TEXT NOT NULL,
  "classId"   TEXT NOT NULL,
  "shiftId"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_attendance_shifts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "class_attendance_shifts_classId_shiftId_key" ON "class_attendance_shifts"("classId", "shiftId");
CREATE INDEX "class_attendance_shifts_schoolId_idx" ON "class_attendance_shifts"("schoolId");
CREATE INDEX "class_attendance_shifts_shiftId_idx" ON "class_attendance_shifts"("shiftId");
ALTER TABLE "class_attendance_shifts"
  ADD CONSTRAINT "class_attendance_shifts_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_attendance_shifts"
  ADD CONSTRAINT "class_attendance_shifts_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "attendance_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation goes in with the table.
ALTER TABLE "class_attendance_shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_attendance_shifts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "class_attendance_shifts_tenant_isolation" ON "class_attendance_shifts"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "class_attendance_shifts" TO app_user;
