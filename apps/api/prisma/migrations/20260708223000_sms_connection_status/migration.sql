-- Hormuud connection status + verification logs (platform-only, no RLS).

ALTER TABLE "sms_global_config" ADD COLUMN IF NOT EXISTS "connectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED';
ALTER TABLE "sms_global_config" ADD COLUMN IF NOT EXISTS "connectionMessage" TEXT;
ALTER TABLE "sms_global_config" ADD COLUMN IF NOT EXISTS "lastTestedAt" TIMESTAMP(3);
ALTER TABLE "sms_global_config" ADD COLUMN IF NOT EXISTS "lastSuccessAt" TIMESTAMP(3);
ALTER TABLE "sms_global_config" ADD COLUMN IF NOT EXISTS "providerBalance" TEXT;
ALTER TABLE "sms_global_config" ADD COLUMN IF NOT EXISTS "connectionVerified" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "sms_connection_logs" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details" JSONB,
  "adminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_connection_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sms_connection_logs_createdAt_idx" ON "sms_connection_logs"("createdAt");
