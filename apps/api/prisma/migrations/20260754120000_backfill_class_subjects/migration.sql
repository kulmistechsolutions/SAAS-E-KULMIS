-- Backfill: every existing teacher assignment implies its subject belongs
-- on the class's own subject list. TeacherAssignmentsService now enforces
-- this going forward for new assignments; this catches up assignments that
-- were created before that fix, so the class report's "Not in class
-- subject list" flag stops firing for data that predates the change.
INSERT INTO "class_subjects" ("id", "schoolId", "academicYearId", "classId", "sectionId", "subjectId", "createdAt")
SELECT DISTINCT ON (ta."schoolId", ta."classId", ta."sectionId", ta."subjectId")
  'backfill_' || ta."id",
  ta."schoolId",
  ta."academicYearId",
  ta."classId",
  ta."sectionId",
  ta."subjectId",
  CURRENT_TIMESTAMP
FROM "teacher_assignments" ta
WHERE NOT EXISTS (
  SELECT 1 FROM "class_subjects" cs
  WHERE cs."schoolId" = ta."schoolId"
    AND cs."classId" = ta."classId"
    AND cs."subjectId" = ta."subjectId"
    AND cs."sectionId" IS NOT DISTINCT FROM ta."sectionId"
)
ON CONFLICT ("schoolId", "classId", "sectionId", "subjectId") DO NOTHING;
