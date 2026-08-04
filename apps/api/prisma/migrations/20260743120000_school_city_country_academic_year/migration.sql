-- Add City / Country / Academic Year to School, previously UI-only fields
-- that silently discarded whatever the school typed on every reload.
ALTER TABLE "schools" ADD COLUMN "city" TEXT;
ALTER TABLE "schools" ADD COLUMN "country" TEXT;
ALTER TABLE "schools" ADD COLUMN "academicYear" TEXT;
