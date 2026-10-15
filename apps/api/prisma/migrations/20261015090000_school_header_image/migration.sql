-- A school's own letterhead banner, printed across the top of documents.
ALTER TABLE "schools" ADD COLUMN "headerImageKey" TEXT;
ALTER TABLE "schools" ADD COLUMN "headerImageHeightMm" INTEGER NOT NULL DEFAULT 32;
ALTER TABLE "schools" ADD COLUMN "headerImageEnabled" BOOLEAN NOT NULL DEFAULT true;
