-- A school's own answer to "what may this role do?".
--
-- The Roles & Permissions screen wrote to the browser's localStorage. A change
-- made there was invisible to the server, invisible to every other machine at
-- the same school, and gone when that browser cleared its data — while the
-- screen went on presenting it as the school's settings. There was nowhere to
-- keep an override, so there was no way to honour one.
--
-- A row here overrides the code's default for one role. Effective permission
-- is the two merged: a module absent falls back to the default, a module
-- present with an empty list is an explicit revoke.

CREATE TABLE "role_permissions" (
  "id"          TEXT NOT NULL,
  "schoolId"    TEXT NOT NULL,
  "role"        TEXT NOT NULL,
  "permissions" JSONB NOT NULL,
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_permissions_schoolId_role_key"
  ON "role_permissions"("schoolId", "role");
CREATE INDEX "role_permissions_schoolId_idx" ON "role_permissions"("schoolId");

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One school must never read or write another's permissions, and this table
-- decides what everyone may do — so it carries the same forced row-level
-- security every tenant table does.
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_tenant_isolation" ON "role_permissions"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "role_permissions" TO app_user;
