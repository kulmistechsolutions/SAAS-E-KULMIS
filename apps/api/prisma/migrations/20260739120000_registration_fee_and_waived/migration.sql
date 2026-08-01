-- A one-time registration fee, separate from the recurring tuition fee.
-- 0 (the default) means the school doesn't use one — nothing changes for
-- a school that never touches this setting.
ALTER TABLE "schools" ADD COLUMN "registrationFeeAmount" INTEGER NOT NULL DEFAULT 0;

-- Permanent tuition exemption, distinct from a $0 monthlyFee (which still
-- creates a $0 charge row every month). A waived student gets no tuition
-- charge row at all. Extra fees are untouched by this.
ALTER TABLE "students" ADD COLUMN "feeWaived" BOOLEAN NOT NULL DEFAULT false;

-- New charge kind for the one-time registration fee, alongside the
-- existing MONTHLY and EXTRA.
ALTER TYPE "FeeChargeKind" ADD VALUE 'REGISTRATION';
