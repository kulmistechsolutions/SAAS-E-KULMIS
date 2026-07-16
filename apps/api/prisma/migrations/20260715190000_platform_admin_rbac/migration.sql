-- Platform admin RBAC: SUPER_ADMIN (full) vs OPERATOR (read-only billing).

DO $$ BEGIN
  CREATE TYPE "PlatformAdminRole" AS ENUM ('SUPER_ADMIN', 'OPERATOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "platform_admins"
  ADD COLUMN IF NOT EXISTS "role" "PlatformAdminRole" NOT NULL DEFAULT 'SUPER_ADMIN';
