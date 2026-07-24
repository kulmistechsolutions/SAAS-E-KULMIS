-- Branding (colours, login title, footer) was only ever held in the browser's
-- memory, so a school's chosen colours reverted to the defaults on the next
-- reload. Persist them on the school itself.
--
-- All nullable: null means "not chosen", and the app keeps using its defaults
-- (login title and footer stay derived from the school name).
ALTER TABLE "schools" ADD COLUMN "primaryColor" TEXT;
ALTER TABLE "schools" ADD COLUMN "secondaryColor" TEXT;
ALTER TABLE "schools" ADD COLUMN "accentColor" TEXT;
ALTER TABLE "schools" ADD COLUMN "brandLoginTitle" TEXT;
ALTER TABLE "schools" ADD COLUMN "brandFooterText" TEXT;
