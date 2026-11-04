-- A class's own attendance times (an early session, a later start). Nothing
-- existing changes: every class starts with no rule and keeps the school's.
CREATE TYPE "AttendanceTimeMode" AS ENUM ('SHIFTED', 'FIXED');

CREATE TABLE "attendance_time_rules" (
  "id"            TEXT NOT NULL,
  "schoolId"      TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "mode"          "AttendanceTimeMode" NOT NULL DEFAULT 'SHIFTED',
  "offsetMinutes" INTEGER NOT NULL DEFAULT 0,
  "startTime"     TEXT,
  "lateTime"      TEXT,
  "endTime"       TEXT,
  "lockTime"      TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_time_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_time_rules_schoolId_name_key" ON "attendance_time_rules"("schoolId", "name");
CREATE INDEX "attendance_time_rules_schoolId_idx" ON "attendance_time_rules"("schoolId");

ALTER TABLE "classes" ADD COLUMN "attendanceTimeRuleId" TEXT;
ALTER TABLE "classes"
  ADD CONSTRAINT "classes_attendanceTimeRuleId_fkey"
  FOREIGN KEY ("attendanceTimeRuleId") REFERENCES "attendance_time_rules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation goes in with the table, not after somebody notices.
ALTER TABLE "attendance_time_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_time_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attendance_time_rules_tenant_isolation" ON "attendance_time_rules"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "attendance_time_rules" TO app_user;
