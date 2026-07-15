-- School Subscription plans (Super Admin managed billing tiers) + per-school
-- assignment. Plans are a platform-level catalog (no RLS, same pattern as
-- sms_packages). School subscriptions are tenant-scoped (RLS applies).

CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id"                    TEXT NOT NULL,
  "name"                  TEXT NOT NULL,
  "maxStudents"           INTEGER,
  "durationDays"          INTEGER NOT NULL,
  "aiGradingMonthlyQuota" INTEGER,
  "priceUsd"              DECIMAL(12,2),
  "isActive"              BOOLEAN NOT NULL DEFAULT true,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_name_key" ON "subscription_plans"("name");

DO $$ BEGIN
  CREATE TYPE "SchoolSubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "school_subscriptions" (
  "id"               TEXT NOT NULL,
  "schoolId"         TEXT NOT NULL,
  "planId"           TEXT NOT NULL,
  "status"           "SchoolSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate"          TIMESTAMP(3) NOT NULL,
  "aiGradingUsed"    INTEGER NOT NULL DEFAULT 0,
  "aiGradingResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_subscriptions_schoolId_key" ON "school_subscriptions"("schoolId");
CREATE INDEX IF NOT EXISTS "school_subscriptions_planId_idx" ON "school_subscriptions"("planId");

ALTER TABLE "school_subscriptions"
  DROP CONSTRAINT IF EXISTS "school_subscriptions_schoolId_fkey";
ALTER TABLE "school_subscriptions"
  ADD CONSTRAINT "school_subscriptions_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school_subscriptions"
  DROP CONSTRAINT IF EXISTS "school_subscriptions_planId_fkey";
ALTER TABLE "school_subscriptions"
  ADD CONSTRAINT "school_subscriptions_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS for the tenant-scoped table
ALTER TABLE "school_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school_subscriptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_school_subscriptions ON "school_subscriptions";
CREATE POLICY tenant_isolation_school_subscriptions ON "school_subscriptions"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription_plans" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "school_subscriptions" TO app_user;
