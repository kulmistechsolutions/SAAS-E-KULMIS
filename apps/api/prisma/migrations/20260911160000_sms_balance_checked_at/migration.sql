-- When the provider balance was last read.
--
-- `providerBalance` has been written by Test Connection for a while, with no
-- record of when — a figure with no timestamp beside it is read as current
-- however old it is, which is the opposite of what a reconciliation needs.
ALTER TABLE "sms_global_config"
  ADD COLUMN IF NOT EXISTS "providerBalanceAt" TIMESTAMP(3);
