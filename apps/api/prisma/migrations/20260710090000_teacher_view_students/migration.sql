-- Per-teacher permission: explicit grant required to view student records.
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "canViewStudents" BOOLEAN NOT NULL DEFAULT false;
