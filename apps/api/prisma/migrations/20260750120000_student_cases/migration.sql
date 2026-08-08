-- Student Cases: a disciplinary/behavior-notes log staff can attach to a
-- student (title, optional note, date), independent of attendance, visible
-- to the school and to that student's own parent.

CREATE TABLE "student_cases" (
  "id"                 TEXT NOT NULL,
  "schoolId"           TEXT NOT NULL,
  "studentId"          TEXT NOT NULL,
  "classId"            TEXT NOT NULL,
  "sectionId"          TEXT,
  "title"              TEXT NOT NULL,
  "note"               TEXT,
  "date"               DATE NOT NULL,
  "recordedByUserId"   TEXT,
  "recordedByUsername" TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "student_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_cases_schoolId_idx" ON "student_cases"("schoolId");
CREATE INDEX "student_cases_schoolId_date_idx" ON "student_cases"("schoolId", "date");
CREATE INDEX "student_cases_studentId_idx" ON "student_cases"("studentId");
CREATE INDEX "student_cases_classId_sectionId_idx" ON "student_cases"("classId", "sectionId");

ALTER TABLE "student_cases"
  ADD CONSTRAINT "student_cases_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS, like every other tenant table.
ALTER TABLE "student_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_cases" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_student_cases ON "student_cases"
    USING ("schoolId" = current_setting('app.current_tenant', true));
