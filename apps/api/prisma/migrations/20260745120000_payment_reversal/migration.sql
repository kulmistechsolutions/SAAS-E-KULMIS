-- Fee payment reversals: a wrong payment is never edited or deleted. It is
-- marked REVERSED and a second, negative Payment row links back to it, so
-- the receipt trail proves both the original collection and its undo.

CREATE TYPE "PaymentStatus" AS ENUM ('ACTIVE', 'REVERSED');

ALTER TABLE "payments" ADD COLUMN "status" "PaymentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "payments" ADD COLUMN "isReversal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN "reversalOfPaymentId" TEXT;
ALTER TABLE "payments" ADD COLUMN "reversedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "reversedByUserId" TEXT;
ALTER TABLE "payments" ADD COLUMN "reversalReason" TEXT;

CREATE UNIQUE INDEX "payments_reversalOfPaymentId_key" ON "payments"("reversalOfPaymentId");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_reversalOfPaymentId_fkey"
  FOREIGN KEY ("reversalOfPaymentId") REFERENCES "payments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Which FeeCharge(s) a payment's money actually went to, so a reversal can
-- undo exactly those charges instead of guessing from the total amount.
CREATE TABLE "payment_allocations" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "feeChargeId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_allocations_schoolId_idx" ON "payment_allocations"("schoolId");
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");
CREATE INDEX "payment_allocations_feeChargeId_idx" ON "payment_allocations"("feeChargeId");

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_feeChargeId_fkey"
  FOREIGN KEY ("feeChargeId") REFERENCES "fee_charges"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS, like every other tenant table.
ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_allocations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payment_allocations ON "payment_allocations"
    USING ("schoolId" = current_setting('app.current_tenant', true));
