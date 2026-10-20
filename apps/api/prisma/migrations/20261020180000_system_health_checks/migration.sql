-- One row every five minutes from the monitor on the server host
-- (/root/ekulmis-health.sh, run by cron). It runs outside the app, so it keeps
-- reporting when the app is down; a gap in the rows is itself the signal that
-- the whole server was off. System table, no RLS — Platform Super Admin only,
-- same pattern as error_logs.
CREATE TABLE IF NOT EXISTS "system_health_checks" (
  "id"             TEXT NOT NULL,
  "checkedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ok"             BOOLEAN NOT NULL,
  "apiMs"          INTEGER,
  "webMs"          INTEGER,
  "dbMs"           INTEGER,
  "sitesChecked"   INTEGER NOT NULL DEFAULT 0,
  "sitesFailed"    INTEGER NOT NULL DEFAULT 0,
  "failedSites"    TEXT,
  "diskPct"        INTEGER,
  "memAvailableMb" INTEGER,
  "load1"          DOUBLE PRECISION,
  "bootedAt"       TIMESTAMP(3),
  "containersDown" TEXT,
  "errors1h"       INTEGER,
  "backupAgeHours" DOUBLE PRECISION,
  "problems"       TEXT,
  CONSTRAINT "system_health_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "system_health_checks_checkedAt_idx"
  ON "system_health_checks"("checkedAt");

GRANT SELECT, INSERT, UPDATE, DELETE ON "system_health_checks" TO app_user;
