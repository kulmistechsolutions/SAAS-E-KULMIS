-- Subscription history, platform audit, and expiry-notice tracking.

ALTER TABLE "school_subscriptions"
  ADD COLUMN IF NOT EXISTS "assignedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedByUsername" TEXT,
  ADD COLUMN IF NOT EXISTS "lastExpiryNoticeDays" INTEGER;

CREATE TABLE IF NOT EXISTS "subscription_history" (
  "id"                 TEXT NOT NULL,
  "schoolId"           TEXT NOT NULL,
  "planId"             TEXT NOT NULL,
  "planName"           TEXT NOT NULL,
  "status"             "SchoolSubscriptionStatus" NOT NULL,
  "startDate"          TIMESTAMP(3) NOT NULL,
  "endDate"            TIMESTAMP(3) NOT NULL,
  "assignedByAdminId"  TEXT,
  "assignedByUsername" TEXT,
  "action"             TEXT NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "subscription_history_schoolId_createdAt_idx"
  ON "subscription_history"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "subscription_history_status_idx"
  ON "subscription_history"("status");
CREATE INDEX IF NOT EXISTS "subscription_history_createdAt_idx"
  ON "subscription_history"("createdAt");

CREATE TABLE IF NOT EXISTS "platform_audit_logs" (
  "id"        TEXT NOT NULL,
  "adminId"   TEXT NOT NULL,
  "username"  TEXT,
  "schoolId"  TEXT,
  "action"    TEXT NOT NULL,
  "module"    TEXT NOT NULL DEFAULT 'subscriptions',
  "oldValue"  JSONB,
  "newValue"  JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_audit_logs_createdAt_idx"
  ON "platform_audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "platform_audit_logs_adminId_createdAt_idx"
  ON "platform_audit_logs"("adminId", "createdAt");
CREATE INDEX IF NOT EXISTS "platform_audit_logs_schoolId_createdAt_idx"
  ON "platform_audit_logs"("schoolId", "createdAt");

GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription_history" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "platform_audit_logs" TO app_user;
