-- Persistent record of unhandled server errors (5xx), across every school.
-- Container stdout logs are wiped on every deploy, so there was previously
-- no durable way for the platform owner to see what's actually failing for
-- schools in production — this table is that record. System table, no RLS
-- (Platform Super Admin needs to query across every tenant), same pattern
-- as platform_audit_logs.
CREATE TABLE IF NOT EXISTS "error_logs" (
  "id"         TEXT NOT NULL,
  "schoolId"   TEXT,
  "userId"     TEXT,
  "role"       TEXT,
  "method"     TEXT NOT NULL,
  "path"       TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "message"    TEXT NOT NULL,
  "stack"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "error_logs_createdAt_idx"
  ON "error_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "error_logs_schoolId_createdAt_idx"
  ON "error_logs"("schoolId", "createdAt");

GRANT SELECT, INSERT, UPDATE, DELETE ON "error_logs" TO app_user;
