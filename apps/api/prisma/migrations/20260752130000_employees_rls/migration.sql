-- The employees table shipped without the tenant-isolation pattern every other
-- tenant-scoped table uses. Reads go through PrismaService.forTenant, which
-- relies entirely on RLS to scope by schoolId (the service issues no schoolId
-- filter of its own), so without these policies one school could read another
-- school's staff. Applied here rather than editing the original migration,
-- which has already run in production.

GRANT SELECT, INSERT, UPDATE, DELETE ON "employees" TO app_user;

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_employees ON "employees"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
