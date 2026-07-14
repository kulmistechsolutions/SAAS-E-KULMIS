-- SMS module tables + RLS for tenant-scoped SMS data.

-- AlterTable
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "smsSenderName" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "smsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SmsPurchaseStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SmsDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SmsCategory" AS ENUM (
    'CUSTOM', 'FEE_REMINDER', 'ANNOUNCEMENT', 'EMERGENCY', 'ATTENDANCE',
    'EXAM_ANNOUNCEMENT', 'EXAM_RESULT', 'ADMISSION', 'REGISTRATION', 'PAYMENT_CONFIRMATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SmsCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SmsTransactionType" AS ENUM ('PURCHASE', 'DEDUCTION', 'ADJUSTMENT', 'REFUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "sms_global_config" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "baseUrl" TEXT NOT NULL DEFAULT 'https://smsapi.hormuud.com',
  "username" TEXT NOT NULL DEFAULT '',
  "password" TEXT NOT NULL DEFAULT '',
  "defaultSenderId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_global_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sms_packages" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "credits" INTEGER NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sms_purchases" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "creditsTotal" INTEGER NOT NULL,
  "creditsRemaining" INTEGER NOT NULL,
  "amountPaid" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "SmsPurchaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "note" TEXT,
  "createdByAdminId" TEXT,
  CONSTRAINT "sms_purchases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sms_campaigns" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "SmsCategory" NOT NULL DEFAULT 'CUSTOM',
  "body" TEXT NOT NULL,
  "status" "SmsCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "audience" TEXT NOT NULL DEFAULT 'CUSTOM',
  "classId" TEXT,
  "sectionId" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "creditsUsed" INTEGER NOT NULL DEFAULT 0,
  "reminderIntervalDays" INTEGER,
  "lastRunAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sms_messages" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "purchaseId" TEXT,
  "campaignId" TEXT,
  "category" "SmsCategory" NOT NULL DEFAULT 'CUSTOM',
  "recipientPhone" TEXT NOT NULL,
  "recipientName" TEXT,
  "recipientType" TEXT,
  "recipientRefId" TEXT,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "creditsUsed" INTEGER NOT NULL DEFAULT 1,
  "status" "SmsDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "providerRefId" TEXT,
  "providerCode" TEXT,
  "providerMessage" TEXT,
  "error" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sms_templates" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "SmsCategory" NOT NULL DEFAULT 'CUSTOM',
  "body" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sms_transactions" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "purchaseId" TEXT,
  "type" "SmsTransactionType" NOT NULL,
  "credits" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "description" TEXT,
  "messageId" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_transactions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "sms_purchases_schoolId_idx" ON "sms_purchases"("schoolId");
CREATE INDEX IF NOT EXISTS "sms_purchases_schoolId_status_idx" ON "sms_purchases"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "sms_messages_schoolId_idx" ON "sms_messages"("schoolId");
CREATE INDEX IF NOT EXISTS "sms_messages_schoolId_status_idx" ON "sms_messages"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "sms_messages_schoolId_createdAt_idx" ON "sms_messages"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "sms_messages_providerMessageId_idx" ON "sms_messages"("providerMessageId");
CREATE INDEX IF NOT EXISTS "sms_templates_schoolId_idx" ON "sms_templates"("schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "sms_templates_schoolId_name_key" ON "sms_templates"("schoolId", "name");
CREATE INDEX IF NOT EXISTS "sms_campaigns_schoolId_idx" ON "sms_campaigns"("schoolId");
CREATE INDEX IF NOT EXISTS "sms_campaigns_schoolId_status_idx" ON "sms_campaigns"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "sms_transactions_schoolId_idx" ON "sms_transactions"("schoolId");
CREATE INDEX IF NOT EXISTS "sms_transactions_schoolId_createdAt_idx" ON "sms_transactions"("schoolId", "createdAt");

-- FKs
DO $$ BEGIN
  ALTER TABLE "sms_purchases" ADD CONSTRAINT "sms_purchases_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sms_purchases" ADD CONSTRAINT "sms_purchases_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "sms_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "sms_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "sms_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sms_transactions" ADD CONSTRAINT "sms_transactions_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sms_transactions" ADD CONSTRAINT "sms_transactions_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "sms_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed empty global config row if missing
INSERT INTO "sms_global_config" ("id", "enabled", "baseUrl", "username", "password", "updatedAt", "createdAt")
SELECT 'sms_global_default', false, 'https://smsapi.hormuud.com', '', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "sms_global_config" LIMIT 1);

-- RLS for tenant-scoped SMS tables (global config + packages stay platform-only, no RLS)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sms_purchases', 'sms_messages', 'sms_templates', 'sms_campaigns', 'sms_transactions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%s ON %I', replace(t, '.', '_'), t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%s ON %I USING ("schoolId" = current_setting(''app.current_tenant'', true)) WITH CHECK ("schoolId" = current_setting(''app.current_tenant'', true))',
      replace(t, '.', '_'),
      t
    );
  END LOOP;
END $$;
