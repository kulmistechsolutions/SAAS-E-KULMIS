-- Teacher.shift (single MORNING | AFTERNOON | BOTH) -> Teacher.shifts
-- (Shift[]), so a teacher who works both shifts is expressed by holding
-- both values instead of a separate BOTH value. Backfills every existing
-- teacher before dropping the old column, so no data is lost:
--   MORNING/AFTERNOON -> a one-element array of that value
--   BOTH               -> [MORNING, AFTERNOON]
ALTER TABLE "teachers" ADD COLUMN "shifts" "Shift"[] NOT NULL DEFAULT '{}';

UPDATE "teachers" SET "shifts" =
  CASE
    WHEN "shift" = 'BOTH' THEN ARRAY['MORNING', 'AFTERNOON']::"Shift"[]
    ELSE ARRAY["shift"]::"Shift"[]
  END;

ALTER TABLE "teachers" ALTER COLUMN "shifts" DROP DEFAULT;
ALTER TABLE "teachers" DROP COLUMN "shift";
