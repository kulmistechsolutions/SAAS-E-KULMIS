-- School self-service subscription purchase (WaafiPay) + teacher cap on plans.

ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "maxTeachers" INTEGER;

DO $$ BEGIN
  CREATE TYPE "SubscriptionPaymentStatus" AS ENUM (
    'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "subscription_payment_orders" (
  "id"                 TEXT NOT NULL,
  "schoolId"           TEXT NOT NULL,
  "planId"             TEXT NOT NULL,
  "referenceId"        TEXT NOT NULL,
  "invoiceId"          TEXT NOT NULL,
  "amount"             DECIMAL(12,2) NOT NULL,
  "currency"           TEXT NOT NULL DEFAULT 'USD',
  "status"             "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paymentMethod"      TEXT NOT NULL DEFAULT 'MWALLET_ACCOUNT',
  "channel"            TEXT NOT NULL DEFAULT 'API_PURCHASE',
  "payerAccount"       TEXT,
  "receiptNumber"      TEXT,
  "waafiRequestId"     TEXT,
  "waafiOrderId"       TEXT,
  "waafiTransactionId" TEXT,
  "waafiIssuerTxnId"   TEXT,
  "hppUrl"             TEXT,
  "requestPayload"     JSONB,
  "responsePayload"    JSONB,
  "callbackPayload"    JSONB,
  "verifyPayload"      JSONB,
  "failureReason"      TEXT,
  "initiatedByUserId"  TEXT,
  "paidAt"             TIMESTAMP(3),
  "expiresAt"          TIMESTAMP(3),
  "activatedAt"        TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_payment_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payment_orders_referenceId_key" ON "subscription_payment_orders"("referenceId");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payment_orders_receiptNumber_key" ON "subscription_payment_orders"("receiptNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payment_orders_waafiTransactionId_key" ON "subscription_payment_orders"("waafiTransactionId");
CREATE INDEX IF NOT EXISTS "subscription_payment_orders_schoolId_idx" ON "subscription_payment_orders"("schoolId");
CREATE INDEX IF NOT EXISTS "subscription_payment_orders_schoolId_status_idx" ON "subscription_payment_orders"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "subscription_payment_orders_status_createdAt_idx" ON "subscription_payment_orders"("status", "createdAt");

ALTER TABLE "subscription_payment_orders"
  DROP CONSTRAINT IF EXISTS "subscription_payment_orders_schoolId_fkey";
ALTER TABLE "subscription_payment_orders"
  ADD CONSTRAINT "subscription_payment_orders_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_payment_orders"
  DROP CONSTRAINT IF EXISTS "subscription_payment_orders_planId_fkey";
ALTER TABLE "subscription_payment_orders"
  ADD CONSTRAINT "subscription_payment_orders_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "subscription_payment_audit_logs" (
  "id"        TEXT NOT NULL,
  "schoolId"  TEXT NOT NULL,
  "orderId"   TEXT NOT NULL,
  "action"    TEXT NOT NULL,
  "success"   BOOLEAN NOT NULL DEFAULT false,
  "message"   TEXT NOT NULL,
  "details"   JSONB,
  "actorId"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_payment_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "subscription_payment_audit_logs_orderId_createdAt_idx"
  ON "subscription_payment_audit_logs"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "subscription_payment_audit_logs_schoolId_createdAt_idx"
  ON "subscription_payment_audit_logs"("schoolId", "createdAt");

ALTER TABLE "subscription_payment_audit_logs"
  DROP CONSTRAINT IF EXISTS "subscription_payment_audit_logs_orderId_fkey";
ALTER TABLE "subscription_payment_audit_logs"
  ADD CONSTRAINT "subscription_payment_audit_logs_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "subscription_payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS for tenant-scoped payment tables
ALTER TABLE "subscription_payment_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_payment_orders" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_subscription_payment_orders ON "subscription_payment_orders";
CREATE POLICY tenant_isolation_subscription_payment_orders ON "subscription_payment_orders"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "subscription_payment_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_payment_audit_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_subscription_payment_audit_logs ON "subscription_payment_audit_logs";
CREATE POLICY tenant_isolation_subscription_payment_audit_logs ON "subscription_payment_audit_logs"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription_payment_orders" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription_payment_audit_logs" TO app_user;
