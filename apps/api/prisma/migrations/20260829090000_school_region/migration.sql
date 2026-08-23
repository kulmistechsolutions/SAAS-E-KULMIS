-- Province / gobol, so the platform owner can group and follow schools by
-- region. Nullable: existing schools keep working until one is filled in.
ALTER TABLE "schools" ADD COLUMN "region" TEXT;
