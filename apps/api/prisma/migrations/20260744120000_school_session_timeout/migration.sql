-- Per-school session length: how long an access token stays valid before
-- the app forces a re-login. Null keeps using the platform default.
ALTER TABLE "schools" ADD COLUMN "sessionTimeoutMinutes" INTEGER;
