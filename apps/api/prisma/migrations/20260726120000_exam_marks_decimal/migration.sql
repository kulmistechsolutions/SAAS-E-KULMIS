-- Marks can now carry a decimal (e.g. 15.8 / 20). The column was an integer,
-- which forced whole numbers and made the bulk import fail on a half mark.
-- Existing integer marks convert cleanly to double precision.
ALTER TABLE "exam_marks" ALTER COLUMN "marks" TYPE DOUBLE PRECISION;
