ALTER TABLE "waafi_payment_config" ADD COLUMN "manualPaymentNumber" TEXT;
ALTER TABLE "waafi_payment_config" ADD COLUMN "manualPaymentInstructions" TEXT;

-- waafi_payment_config is meant to be a singleton, but a race in the old
-- "create if missing" code path (no fixed id) could produce more than one
-- row, after which reads/writes nondeterministically hit different rows.
-- Keep only the oldest row (the one first configured with real credentials).
DELETE FROM "waafi_payment_config"
WHERE "id" NOT IN (
  SELECT "id" FROM "waafi_payment_config" ORDER BY "createdAt" ASC LIMIT 1
);
