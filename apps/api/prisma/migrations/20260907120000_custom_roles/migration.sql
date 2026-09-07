-- A role a school made for itself: "Library Officer", "Vice Principal".
--
-- The built-in roles are the product's. These are the school's, and until now
-- the Roles & Permissions screen offered an Add Role button that wrote to the
-- browser and nowhere else — so the role existed on one machine, could not be
-- given to anybody, and vanished when that browser cleared its data.
--
-- Permissions for one of these live in role_permissions keyed by this row's
-- id, exactly as an override of a built-in role does, so every guard reads
-- one place either way. A user points at the id rather than the name, so
-- renaming a role never orphans anybody.

CREATE TABLE "custom_roles" (
  "id"          TEXT NOT NULL,
  "schoolId"    TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_roles_schoolId_name_key" ON "custom_roles"("schoolId", "name");
CREATE INDEX "custom_roles_schoolId_idx" ON "custom_roles"("schoolId");

ALTER TABLE "custom_roles"
  ADD CONSTRAINT "custom_roles_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One school must never read or write another's roles.
ALTER TABLE "custom_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "custom_roles_tenant_isolation" ON "custom_roles"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "custom_roles" TO app_user;

-- Nullable and additive: every existing account keeps the built-in role it
-- has, and a null here means "no role of the school's own".
ALTER TABLE "users" ADD COLUMN "customRoleId" TEXT;

ALTER TABLE "users"
  ADD CONSTRAINT "users_customRoleId_fkey"
  FOREIGN KEY ("customRoleId") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "users_customRoleId_idx" ON "users"("customRoleId");
