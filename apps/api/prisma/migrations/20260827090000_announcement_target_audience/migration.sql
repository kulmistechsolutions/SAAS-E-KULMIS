-- Announcements were only ever filtered by category ("audience"), never by
-- who they were addressed to. Add the real recipient-scope column so each
-- portal's bulletin board can filter to what it's allowed to see.
ALTER TABLE "announcements" ADD COLUMN "targetAudience" TEXT NOT NULL DEFAULT 'ALL';
