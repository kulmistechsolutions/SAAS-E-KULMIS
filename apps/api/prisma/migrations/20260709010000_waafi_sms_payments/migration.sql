-- WaafiPay SMS package purchase orders + gateway config.

DO $$ BEGIN
  CREATE TYPE "SmsPaymentStatus" AS ENUM (
    'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'EXPIRED', 'REFUNDED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "waafi_payment_config" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "baseUrl" TEXT NOT NULL DEFAULT 'https://sandbox.waafipay.net/asm',
  "merchantUid" TEXT NOT NULL DEFAULT '',
  "apiUserId" TEXT NOT NULL DEFAULT '',
  "apiKey" TEXT NOT NULL DEFAULT '',
  "storeId" TEXT NOT NULL DEFAULT '',
  "hppKey" TEXT NOT NULL DEFAULT '',
  "defaultMethod" TEXT NOT NULL DEFAULT 'API_PURCHASE',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "callbackBaseUrl" TEXT,
  "connectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "connectionMessage" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "connectionVerified" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "waafi_payment_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sms_payment_orders" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "credits" INTEGER NOT NULL,
  "status" "SmsPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" TEXT NOT NULL DEFAULT 'MWALLET_ACCOUNT',
  "channel" TEXT NOT NULL DEFAULT 'API_PURCHASE',
  "payerAccount" TEXT,
  "receiptNumber" TEXT,
  "waafiRequestId" TEXT,
  "waafiOrderId" TEXT,
  "waafiTransactionId" TEXT,
  "waafiIssuerTxnId" TEXT,
  "hppUrl" TEXT,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "callbackPayload" JSONB,
  "verifyPayload" JSONB,
  "failureReason" TEXT,
  "initiatedByUserId" TEXT,
  "paidAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_payment_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sms_payment_orders_referenceId_key" ON "sms_payment_orders"("referenceId");
CREATE UNIQUE INDEX IF NOT EXISTS "sms_payment_orders_receiptNumber_key" ON "sms_payment_orders"("receiptNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "sms_payment_orders_waafiTransactionId_key" ON "sms_payment_orders"("waafiTransactionId");
CREATE INDEX IF NOT EXISTS "sms_payment_orders_schoolId_idx" ON "sms_payment_orders"("schoolId");
CREATE INDEX IF NOT EXISTS "sms_payment_orders_schoolId_status_idx" ON "sms_payment_orders"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "sms_payment_orders_status_createdAt_idx" ON "sms_payment_orders"("status", "createdAt");

ALTER TABLE "sms_payment_orders"
  DROP CONSTRAINT IF EXISTS "sms_payment_orders_schoolId_fkey";
ALTER TABLE "sms_payment_orders"
  ADD CONSTRAINT "sms_payment_orders_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sms_payment_orders"
  DROP CONSTRAINT IF EXISTS "sms_payment_orders_packageId_fkey";
ALTER TABLE "sms_payment_orders"
  ADD CONSTRAINT "sms_payment_orders_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "sms_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sms_payment_audit_logs" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "message" TEXT NOT NULL,
  "details" JSONB,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_payment_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sms_payment_audit_logs_orderId_createdAt_idx"
  ON "sms_payment_audit_logs"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "sms_payment_audit_logs_schoolId_createdAt_idx"
  ON "sms_payment_audit_logs"("schoolId", "createdAt");

ALTER TABLE "sms_payment_audit_logs"
  DROP CONSTRAINT IF EXISTS "sms_payment_audit_logs_orderId_fkey";
ALTER TABLE "sms_payment_audit_logs"
  ADD CONSTRAINT "sms_payment_audit_logs_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "sms_payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link purchases to payment orders
ALTER TABLE "sms_purchases" ADD COLUMN IF NOT EXISTS "paymentOrderId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "sms_purchases_paymentOrderId_key" ON "sms_purchases"("paymentOrderId");
ALTER TABLE "sms_purchases"
  DROP CONSTRAINT IF EXISTS "sms_purchases_paymentOrderId_fkey";
ALTER TABLE "sms_purchases"
  ADD CONSTRAINT "sms_purchases_paymentOrderId_fkey"
  FOREIGN KEY ("paymentOrderId") REFERENCES "sms_payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS for tenant-scoped payment tables
ALTER TABLE "sms_payment_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_payment_orders" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_sms_payment_orders ON "sms_payment_orders";
CREATE POLICY tenant_isolation_sms_payment_orders ON "sms_payment_orders"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "sms_payment_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_payment_audit_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_sms_payment_audit_logs ON "sms_payment_audit_logs";
CREATE POLICY tenant_isolation_sms_payment_audit_logs ON "sms_payment_audit_logs"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "sms_payment_orders" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sms_payment_audit_logs" TO app_user;
