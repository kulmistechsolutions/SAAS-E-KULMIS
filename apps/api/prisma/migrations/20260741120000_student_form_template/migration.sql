-- Two registration form layouts. STANDARD is the form every existing school
-- already uses, so the default keeps them on exactly what they have today —
-- switching to DETAILED is an explicit, opt-in choice in Settings > Students.
CREATE TYPE "StudentFormTemplate" AS ENUM ('STANDARD', 'DETAILED');

ALTER TABLE "schools"
  ADD COLUMN "studentFormTemplate" "StudentFormTemplate" NOT NULL DEFAULT 'STANDARD';

-- Extra bio fields the DETAILED form collects. All nullable: every existing
-- student keeps its current record untouched, and a school on the STANDARD
-- form never populates them.
ALTER TABLE "students"
  ADD COLUMN "placeOfBirth" TEXT,
  ADD COLUMN "district"     TEXT,
  ADD COLUMN "motherName"   TEXT;
