-- Dev/demo simulation mode for WaafiPay (no live gateway required).
ALTER TABLE "waafi_payment_config"
  ADD COLUMN IF NOT EXISTS "simulationMode" BOOLEAN NOT NULL DEFAULT false;
