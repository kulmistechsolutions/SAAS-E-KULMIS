-- Three tenant tables were never given Row-Level Security, so the tenant
-- context `forTenant` sets did nothing for them: a query scoped to one school
-- could read (and in salary_payments' case mutate) another school's rows,
-- because these services filter by id/salaryId alone and relied on RLS to add
-- the school boundary. Verified against production: as app_user pinned to one
-- school, salary_payments exposed 5 schools and counters 23.
--
-- Same policy shape as every other tenant table (see earlier migrations).

ALTER TABLE "salary_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "salary_payments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_salary_payments" ON "salary_payments";
CREATE POLICY "tenant_isolation_salary_payments" ON "salary_payments"
  USING ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "counters" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_counters" ON "counters";
CREATE POLICY "tenant_isolation_counters" ON "counters"
  USING ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "academic_year_fee_setups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_year_fee_setups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_academic_year_fee_setups" ON "academic_year_fee_setups";
CREATE POLICY "tenant_isolation_academic_year_fee_setups" ON "academic_year_fee_setups"
  USING ("schoolId" = current_setting('app.current_tenant', true));
