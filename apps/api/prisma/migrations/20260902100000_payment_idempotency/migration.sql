-- A key the client sends so a resubmitted collection settles once.
--
-- A slow network, an impatient second click, a retry after a timeout: each
-- posts the same payment again, and with nothing to recognise it by the school
-- takes the money twice and hands the family two receipts. Existing payments
-- carry NULL, which the partial index below deliberately leaves unconstrained
-- so the whole history does not collide on a single null key.

ALTER TABLE "payments" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "payments_schoolId_idempotencyKey_key"
  ON "payments"("schoolId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
