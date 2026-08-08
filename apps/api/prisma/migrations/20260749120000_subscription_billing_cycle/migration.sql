-- Self-service subscription purchases become billing-cycle aware
-- (Monthly/Yearly) and plans can optionally price per-student instead of a
-- flat fee, so a school's cost scales with its actual size instead of
-- silently exceeding a plan's nominal capacity.

CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

ALTER TABLE "subscription_plans" ADD COLUMN "pricePerStudentUsd" DECIMAL(10,4);

ALTER TABLE "school_subscriptions" ADD COLUMN "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY';

ALTER TABLE "subscription_payment_orders" ADD COLUMN "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "subscription_payment_orders" ADD COLUMN "studentCountAtPurchase" INTEGER;
