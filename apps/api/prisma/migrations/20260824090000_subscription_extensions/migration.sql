-- Subscription "Extend" — a school tops up its student/teacher/AI capacity
-- mid-cycle without switching plans, paying only for the days left in the
-- current billing period. Mirrors subscription_payment_orders exactly (same
-- WaafiPay flow) but adds to the subscription's capacity instead of
-- replacing the plan, and resets on renewal.

ALTER TABLE "subscription_plans" ADD COLUMN "extendPricePerStudentUsd" DECIMAL(10,4);
ALTER TABLE "subscription_plans" ADD COLUMN "extendPricePerTeacherUsd" DECIMAL(10,4);
ALTER TABLE "subscription_plans" ADD COLUMN "extendPricePerAiCreditUsd" DECIMAL(10,4);

ALTER TABLE "school_subscriptions" ADD COLUMN "extraStudents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "school_subscriptions" ADD COLUMN "extraTeachers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "school_subscriptions" ADD COLUMN "extraAiGradingQuota" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "subscription_extension_orders" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subscriptionPlanId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceUsd" DECIMAL(10,4) NOT NULL,
    "cycleTotalDays" INTEGER NOT NULL,
    "cycleRemainingDays" INTEGER NOT NULL,
    "referenceId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
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

    CONSTRAINT "subscription_extension_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_extension_orders_referenceId_key" ON "subscription_extension_orders"("referenceId");
CREATE UNIQUE INDEX "subscription_extension_orders_receiptNumber_key" ON "subscription_extension_orders"("receiptNumber");
CREATE UNIQUE INDEX "subscription_extension_orders_waafiTransactionId_key" ON "subscription_extension_orders"("waafiTransactionId");
CREATE INDEX "subscription_extension_orders_schoolId_idx" ON "subscription_extension_orders"("schoolId");
CREATE INDEX "subscription_extension_orders_schoolId_status_idx" ON "subscription_extension_orders"("schoolId", "status");
CREATE INDEX "subscription_extension_orders_status_createdAt_idx" ON "subscription_extension_orders"("status", "createdAt");

ALTER TABLE "subscription_extension_orders" ADD CONSTRAINT "subscription_extension_orders_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_extension_orders" ADD CONSTRAINT "subscription_extension_orders_planId_fkey"
  FOREIGN KEY ("subscriptionPlanId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_extension_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_extension_orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subscription_extension_orders ON "subscription_extension_orders"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
