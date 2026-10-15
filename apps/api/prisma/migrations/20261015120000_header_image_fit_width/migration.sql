-- The letterhead now fits the page width by default (0). The fixed 32 mm
-- default shrank wide banners narrower than the page; no school had chosen
-- a height yet (the feature shipped the same day), so the old default moves.
ALTER TABLE "schools" ALTER COLUMN "headerImageHeightMm" SET DEFAULT 0;
UPDATE "schools" SET "headerImageHeightMm" = 0 WHERE "headerImageHeightMm" = 32;
