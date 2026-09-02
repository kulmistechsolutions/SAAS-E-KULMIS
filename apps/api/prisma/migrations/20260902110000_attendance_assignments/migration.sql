-- Where each attendance officer is allowed to take attendance.
--
-- The role already existed and was granted the attendance module wholesale,
-- so every officer could see and mark every class in the school. A school with
-- four officers had four people able to alter anyone's register, and nothing
-- recorded that it should have been otherwise.

CREATE TABLE "attendance_assignments" (
  "id"              TEXT NOT NULL,
  "schoolId"        TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "classId"         TEXT NOT NULL,
  -- NULL means the whole class; NULL shift means every shift. Most schools
  -- assign "Grade 1, mornings" rather than enumerating sections.
  "sectionId"       TEXT,
  "shiftId"         TEXT,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_assignments_schoolId_idx" ON "attendance_assignments"("schoolId");
CREATE INDEX "attendance_assignments_userId_idx" ON "attendance_assignments"("userId");
CREATE INDEX "attendance_assignments_classId_idx" ON "attendance_assignments"("classId");

-- Postgres treats NULLs as distinct, so this index alone would let the same
-- whole-class grant be added twice. The four partial indexes below close that:
-- one for each combination of the two nullable columns.
CREATE UNIQUE INDEX "attendance_assignments_userId_classId_sectionId_shiftId_key"
  ON "attendance_assignments"("userId", "classId", "sectionId", "shiftId");

CREATE UNIQUE INDEX "attendance_assignments_uniq_class_only"
  ON "attendance_assignments"("userId", "classId")
  WHERE "sectionId" IS NULL AND "shiftId" IS NULL;

CREATE UNIQUE INDEX "attendance_assignments_uniq_class_shift"
  ON "attendance_assignments"("userId", "classId", "shiftId")
  WHERE "sectionId" IS NULL AND "shiftId" IS NOT NULL;

CREATE UNIQUE INDEX "attendance_assignments_uniq_class_section"
  ON "attendance_assignments"("userId", "classId", "sectionId")
  WHERE "sectionId" IS NOT NULL AND "shiftId" IS NULL;

ALTER TABLE "attendance_assignments"
  ADD CONSTRAINT "attendance_assignments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_assignments"
  ADD CONSTRAINT "attendance_assignments_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_assignments"
  ADD CONSTRAINT "attendance_assignments_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_assignments"
  ADD CONSTRAINT "attendance_assignments_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "attendance_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation, with the table rather than after somebody notices.
ALTER TABLE "attendance_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attendance_assignments_tenant_isolation" ON "attendance_assignments"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "attendance_assignments" TO app_user;
