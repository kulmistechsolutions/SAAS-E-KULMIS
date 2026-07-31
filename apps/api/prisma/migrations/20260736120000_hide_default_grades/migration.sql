-- Lets a school hide the leftover default Grade 1-12 list from every class
-- picker once its own levels cover its classes. Additive and defaulted, so
-- no existing school is affected.
ALTER TABLE "schools"
    ADD COLUMN "hideDefaultGrades" BOOLEAN NOT NULL DEFAULT false;
