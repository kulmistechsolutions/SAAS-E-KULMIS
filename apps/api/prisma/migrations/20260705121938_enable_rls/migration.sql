-- Phase 0.5 — Multi-tenant Row-Level Security (RLS).
--
-- We connect to Postgres as the table owner (Supabase `postgres` role), so a
-- plain `ENABLE ROW LEVEL SECURITY` would be bypassed by the owner. `FORCE`
-- makes RLS apply to the owner too. EVERY tenant-scoped table added in later
-- phases must repeat this exact pattern.
--
-- The tenant is provided per transaction via:
--   SELECT set_config('app.current_tenant', '<schoolId>', true);
-- (see PrismaService.forTenant). `current_setting(..., true)` returns NULL when
-- unset, so with no tenant context NO rows are visible — safe by default.
--
-- The `schools` table is intentionally left without RLS: it is the tenant
-- registry the middleware reads (by subdomain) *before* a tenant is known.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_users ON "users"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
