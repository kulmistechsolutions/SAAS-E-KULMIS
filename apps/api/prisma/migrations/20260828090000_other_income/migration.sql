-- Income a school receives outside fee collection (donations, rent, canteen,
-- transport, grants). Mirrors the expense side, including its RLS policy, so
-- Net Income can reflect everything that came in rather than fees alone.

CREATE TABLE "income_categories" (
  "id"        TEXT NOT NULL,
  "schoolId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "income_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "income_categories_schoolId_name_key" ON "income_categories"("schoolId", "name");
CREATE INDEX "income_categories_schoolId_idx" ON "income_categories"("schoolId");

CREATE TABLE "other_income" (
  "id"               TEXT NOT NULL,
  "schoolId"         TEXT NOT NULL,
  "categoryId"       TEXT,
  "title"            TEXT NOT NULL,
  "source"           TEXT,
  "amount"           INTEGER NOT NULL,
  "method"           TEXT,
  "note"             TEXT,
  "recordedByUserId" TEXT,
  "receivedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "other_income_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "other_income_schoolId_idx" ON "other_income"("schoolId");

ALTER TABLE "other_income" ADD CONSTRAINT "other_income_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "income_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same tenant isolation every other school-scoped table has.
ALTER TABLE "income_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "income_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_income_categories" ON "income_categories"
  USING ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "other_income" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "other_income" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_other_income" ON "other_income"
  USING ("schoolId" = current_setting('app.current_tenant', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "income_categories" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "other_income" TO app_user;
