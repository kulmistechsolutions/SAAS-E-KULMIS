-- Phase 0.5 — enforce RLS despite connecting as a privileged role.
--
-- Supabase's `postgres` role has BYPASSRLS, so RLS policies never apply to it
-- (even with FORCE). The fix: a dedicated non-privileged role that RLS *does*
-- apply to. The app connects as `postgres`, then `SET LOCAL ROLE app_user`
-- inside each tenant transaction (see PrismaService.forTenant), dropping to a
-- role that is subject to the tenant_isolation policies.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- Let the connecting role switch into app_user for the duration of a tx.
GRANT app_user TO postgres;
