-- The "Pin to top" checkbox on the Send Notice dialog has always existed in
-- the UI but never persisted anywhere — add the column so it actually does
-- something.

ALTER TABLE "announcements" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
