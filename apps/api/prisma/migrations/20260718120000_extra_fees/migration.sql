-- Extra fees: additional one-off charges (e.g. an exam fee) set up separately
-- and billed into a given month on top of that month's regular fee.

-- 1. Charge kind enum.
DO $$ BEGIN
  CREATE TYPE "FeeChargeKind" AS ENUM ('MONTHLY', 'EXTRA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extra fee setup tables.
CREATE TABLE IF NOT EXISTS "extra_fees" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "defaultAmount" INTEGER,
  "appliesToAllClasses" BOOLEAN NOT NULL DEFAULT true,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "appliedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "extra_fees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "extra_fees_schoolId_idx" ON "extra_fees" ("schoolId");
CREATE INDEX IF NOT EXISTS "extra_fees_academicYearId_idx" ON "extra_fees" ("academicYearId");

CREATE TABLE IF NOT EXISTS "extra_fee_class_amounts" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "extraFeeId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  CONSTRAINT "extra_fee_class_amounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "extra_fee_class_amounts_extraFeeId_classId_key"
  ON "extra_fee_class_amounts" ("extraFeeId", "classId");
CREATE INDEX IF NOT EXISTS "extra_fee_class_amounts_schoolId_idx" ON "extra_fee_class_amounts" ("schoolId");
CREATE INDEX IF NOT EXISTS "extra_fee_class_amounts_classId_idx" ON "extra_fee_class_amounts" ("classId");

-- 3. Foreign keys.
ALTER TABLE "extra_fees"
  ADD CONSTRAINT "extra_fees_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "extra_fee_class_amounts"
  ADD CONSTRAINT "extra_fee_class_amounts_extraFeeId_fkey"
  FOREIGN KEY ("extraFeeId") REFERENCES "extra_fees" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "extra_fee_class_amounts"
  ADD CONSTRAINT "extra_fee_class_amounts_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. New columns on fee_charges.
ALTER TABLE "fee_charges"
  ADD COLUMN IF NOT EXISTS "kind" "FeeChargeKind" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "extraFeeId" TEXT;

ALTER TABLE "fee_charges"
  ADD CONSTRAINT "fee_charges_extraFeeId_fkey"
  FOREIGN KEY ("extraFeeId") REFERENCES "extra_fees" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Replace the whole-table unique with a PARTIAL unique index.
--    "one regular fee per student per month" must still hold, but a month may
--    now also carry any number of EXTRA rows, which the old constraint blocked.
ALTER TABLE "fee_charges"
  DROP CONSTRAINT IF EXISTS "fee_charges_schoolId_studentId_year_month_key";
DROP INDEX IF EXISTS "fee_charges_schoolId_studentId_year_month_key";

CREATE UNIQUE INDEX IF NOT EXISTS "fee_charges_monthly_unique"
  ON "fee_charges" ("schoolId", "studentId", "year", "month")
  WHERE "kind" = 'MONTHLY';

CREATE INDEX IF NOT EXISTS "fee_charges_schoolId_studentId_year_month_idx"
  ON "fee_charges" ("schoolId", "studentId", "year", "month");
CREATE INDEX IF NOT EXISTS "fee_charges_extraFeeId_idx" ON "fee_charges" ("extraFeeId");

-- 6. Row-Level Security (tenant isolation).
ALTER TABLE "extra_fees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extra_fees" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_extra_fees ON "extra_fees"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "extra_fee_class_amounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extra_fee_class_amounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_extra_fee_class_amounts ON "extra_fee_class_amounts"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

-- 7. Grant the restricted runtime role access (RLS still applies).
GRANT SELECT, INSERT, UPDATE, DELETE ON "extra_fees" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "extra_fee_class_amounts" TO app_user;
