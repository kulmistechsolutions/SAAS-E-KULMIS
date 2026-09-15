-- A school that needs 640 SMS should not have to buy 1,000, and the platform
-- should not have to invent a package every time somebody asks. One rate,
-- with a floor and a ceiling, prices any quantity.
ALTER TABLE "sms_global_config"
  ADD COLUMN IF NOT EXISTS "customPricePerSms" DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS "customMinSms" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "customMaxSms" INTEGER NOT NULL DEFAULT 20000;
