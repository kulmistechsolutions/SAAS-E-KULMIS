-- A school's own Hormuud gateway credentials, plus the Super Admin licence
-- that unlocks using them. Like `schools` these are keyed by schoolId and are
-- only ever read through the authenticated school's own id, so they follow the
-- tenant-registry pattern (no RLS policy) rather than the tenant-table one.

CREATE TABLE IF NOT EXISTS "school_sms_gateways" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "baseUrl" TEXT NOT NULL DEFAULT 'https://smsapi.hormuud.com',
  "username" TEXT NOT NULL DEFAULT '',
  "password" TEXT NOT NULL DEFAULT '',
  "senderId" TEXT,
  "connectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "connectionMessage" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "providerBalance" TEXT,
  "connectionVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_sms_gateways_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_sms_gateways_schoolId_key"
  ON "school_sms_gateways" ("schoolId");

CREATE TABLE IF NOT EXISTS "sms_gateway_licenses" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "durationMonths" INTEGER NOT NULL,
  "price" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "note" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_gateway_licenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sms_gateway_licenses_schoolId_idx"
  ON "sms_gateway_licenses" ("schoolId");
CREATE INDEX IF NOT EXISTS "sms_gateway_licenses_status_endDate_idx"
  ON "sms_gateway_licenses" ("status", "endDate");

ALTER TABLE "school_sms_gateways"
  ADD CONSTRAINT "school_sms_gateways_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_gateway_licenses"
  ADD CONSTRAINT "sms_gateway_licenses_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "school_sms_gateways" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sms_gateway_licenses" TO app_user;
