-- Fee adjustments and the fee-change log.
--
-- Two things the module could not express. A school discounting one month had
-- to change the student's permanent fee to do it, which then followed them
-- into every later month; and a fee that changed left no record of when, by
-- whom, or how far it was meant to reach.

CREATE TYPE "FeeAdjustmentType" AS ENUM ('DISCOUNT', 'WAIVER', 'ADJUSTMENT');

CREATE TYPE "FeeChangeScope" AS ENUM (
  'CURRENT_MONTH', 'FUTURE_MONTHS', 'CURRENT_AND_FUTURE', 'ALL_UNPAID'
);

CREATE TABLE "fee_adjustments" (
  "id"                TEXT NOT NULL,
  "schoolId"          TEXT NOT NULL,
  "studentId"         TEXT NOT NULL,
  "feeChargeId"       TEXT NOT NULL,
  "type"              "FeeAdjustmentType" NOT NULL,
  "originalAmount"    INTEGER NOT NULL,
  "amount"            INTEGER NOT NULL,
  "reason"            TEXT NOT NULL,
  "createdByUserId"   TEXT,
  "createdByUsername" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fee_adjustments_schoolId_createdAt_idx"
  ON "fee_adjustments"("schoolId", "createdAt");
CREATE INDEX "fee_adjustments_feeChargeId_idx" ON "fee_adjustments"("feeChargeId");
CREATE INDEX "fee_adjustments_studentId_idx" ON "fee_adjustments"("studentId");

ALTER TABLE "fee_adjustments"
  ADD CONSTRAINT "fee_adjustments_feeChargeId_fkey"
  FOREIGN KEY ("feeChargeId") REFERENCES "fee_charges"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_adjustments"
  ADD CONSTRAINT "fee_adjustments_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "fee_change_logs" (
  "id"                TEXT NOT NULL,
  "schoolId"          TEXT NOT NULL,
  "studentId"         TEXT NOT NULL,
  "oldFee"            INTEGER NOT NULL,
  "newFee"            INTEGER NOT NULL,
  "scope"             "FeeChangeScope" NOT NULL,
  "chargesUpdated"    INTEGER NOT NULL DEFAULT 0,
  "reason"            TEXT,
  "changedByUserId"   TEXT,
  "changedByUsername" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fee_change_logs_schoolId_createdAt_idx"
  ON "fee_change_logs"("schoolId", "createdAt");
CREATE INDEX "fee_change_logs_studentId_idx" ON "fee_change_logs"("studentId");

ALTER TABLE "fee_change_logs"
  ADD CONSTRAINT "fee_change_logs_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation. A table carrying schoolId without a policy is readable
-- across schools — this bit us on three tables before, so it goes in with the
-- table rather than after somebody notices.
ALTER TABLE "fee_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_adjustments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "fee_adjustments_tenant_isolation" ON "fee_adjustments"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "fee_adjustments" TO app_user;

ALTER TABLE "fee_change_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_change_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "fee_change_logs_tenant_isolation" ON "fee_change_logs"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "fee_change_logs" TO app_user;
