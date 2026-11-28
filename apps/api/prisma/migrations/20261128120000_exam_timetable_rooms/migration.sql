-- Exam rooms, exam timetables and their mixed seating plans. New tables
-- only; nothing existing changes.
CREATE TABLE "exam_rooms" (
  "id"        TEXT NOT NULL,
  "schoolId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "building"  TEXT,
  "rows"      INTEGER NOT NULL,
  "cols"      INTEGER NOT NULL,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exam_rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "exam_rooms_schoolId_name_key" ON "exam_rooms"("schoolId", "name");
CREATE INDEX "exam_rooms_schoolId_idx" ON "exam_rooms"("schoolId");

CREATE TABLE "exam_timetables" (
  "id"           TEXT NOT NULL,
  "schoolId"     TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "entries"      JSONB NOT NULL DEFAULT '[]',
  "seating"      JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exam_timetables_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exam_timetables_schoolId_idx" ON "exam_timetables"("schoolId");

-- Tenant isolation goes in with the tables, not after somebody notices.
ALTER TABLE "exam_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_rooms" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exam_rooms_tenant_isolation" ON "exam_rooms"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "exam_rooms" TO app_user;

ALTER TABLE "exam_timetables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_timetables" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exam_timetables_tenant_isolation" ON "exam_timetables"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "exam_timetables" TO app_user;
