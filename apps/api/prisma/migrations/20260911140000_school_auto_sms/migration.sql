-- Automatic SMS, one switch per event.
--
-- All four default to false. An automatic message spends the school's credits
-- without anyone pressing a button, so a school opts in deliberately — nobody
-- discovers this feature by reading their balance.
ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "smsAutoFee" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "smsAutoRegistration" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "smsAutoAttendance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "smsAutoResult" BOOLEAN NOT NULL DEFAULT false;
