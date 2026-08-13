CREATE TABLE "student_class_enrollments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_class_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_class_enrollments_schoolId_idx" ON "student_class_enrollments"("schoolId");
CREATE INDEX "student_class_enrollments_classId_idx" ON "student_class_enrollments"("classId");
CREATE INDEX "student_class_enrollments_studentId_idx" ON "student_class_enrollments"("studentId");
CREATE UNIQUE INDEX "student_class_enrollments_studentId_classId_key" ON "student_class_enrollments"("studentId", "classId");

ALTER TABLE "student_class_enrollments" ADD CONSTRAINT "student_class_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_class_enrollments" ADD CONSTRAINT "student_class_enrollments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_class_enrollments" ADD CONSTRAINT "student_class_enrollments_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation, same pattern as every other tenant-scoped table.
GRANT SELECT, INSERT, UPDATE, DELETE ON "student_class_enrollments" TO app_user;

ALTER TABLE "student_class_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_class_enrollments" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_student_class_enrollments ON "student_class_enrollments"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
