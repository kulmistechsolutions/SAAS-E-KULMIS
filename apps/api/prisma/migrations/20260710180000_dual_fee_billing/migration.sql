-- Dual fee billing mode: school settings, academic year setup, student fee start, INACTIVE status

CREATE TYPE "BillingMode" AS ENUM ('MONTHLY', 'ACADEMIC_YEAR');
CREATE TYPE "FeeStartMode" AS ENUM ('FULL_CURRENT', 'AGREEMENT', 'NEXT_MONTH');

ALTER TYPE "FeeStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';

ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "billingMode" "BillingMode" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "feeAcademicMonths" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "feeBillingStartMonth" INTEGER NOT NULL DEFAULT 9;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "feeBillingEndMonth" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "feeAllowPartial" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "feeAllowAdvance" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "feeCarryForward" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "feeMonthSetupDay" INTEGER NOT NULL DEFAULT 25;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "annualFeeAmount" INTEGER;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "feeStartMode" "FeeStartMode";
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "feeAgreementAmount" INTEGER;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "feeBillingStartYear" INTEGER;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "feeBillingStartMonth" INTEGER;

ALTER TABLE "fee_charges" ADD COLUMN IF NOT EXISTS "academicYearId" TEXT;

CREATE TABLE IF NOT EXISTS "academic_year_fee_setups" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "academicMonths" INTEGER NOT NULL,
  "billingStartMonth" INTEGER NOT NULL,
  "billingEndMonth" INTEGER NOT NULL,
  "monthlyFee" INTEGER,
  "totalAnnualFee" INTEGER NOT NULL,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academic_year_fee_setups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_year_fee_setups_schoolId_academicYearId_key"
  ON "academic_year_fee_setups"("schoolId", "academicYearId");
CREATE INDEX IF NOT EXISTS "academic_year_fee_setups_schoolId_idx"
  ON "academic_year_fee_setups"("schoolId");
CREATE INDEX IF NOT EXISTS "fee_charges_academicYearId_idx"
  ON "fee_charges"("academicYearId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_charges_academicYearId_fkey') THEN
    ALTER TABLE "fee_charges"
      ADD CONSTRAINT "fee_charges_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_year_fee_setups_academicYearId_fkey') THEN
    ALTER TABLE "academic_year_fee_setups"
      ADD CONSTRAINT "academic_year_fee_setups_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
