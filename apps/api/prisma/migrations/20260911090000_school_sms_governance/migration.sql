-- Platform-only SMS governance for a school.
--
-- `smsEnabled` is the school's own switch and stays that way. These four are
-- the platform owner's, and no school-facing route writes them: a suspended
-- school cannot lift its own suspension by toggling the switch it does own.
--
-- Limits of 0 mean "no limit", which is what every existing school gets, so
-- nothing changes for anyone until Super Admin sets one.
ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "smsSuspended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "smsSuspendedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "smsDailyLimit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "smsMonthlyLimit" INTEGER NOT NULL DEFAULT 0;
