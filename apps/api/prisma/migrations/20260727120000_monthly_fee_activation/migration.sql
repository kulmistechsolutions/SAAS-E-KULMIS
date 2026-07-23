-- Monthly billing no longer starts on its own. A class-month must be activated
-- (via the monthly fee setup) before any student in it is charged.
CREATE TABLE "monthly_fee_activations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "classId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_fee_activations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_fee_activations_schoolId_year_month_classId_key"
    ON "monthly_fee_activations"("schoolId", "year", "month", "classId");

CREATE INDEX "monthly_fee_activations_schoolId_year_month_idx"
    ON "monthly_fee_activations"("schoolId", "year", "month");

CREATE INDEX "monthly_fee_activations_classId_idx"
    ON "monthly_fee_activations"("classId");

ALTER TABLE "monthly_fee_activations"
    ADD CONSTRAINT "monthly_fee_activations_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: same tenant isolation as every other domain table.
ALTER TABLE "monthly_fee_activations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_fee_activations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_monthly_fee_activations ON "monthly_fee_activations"
    USING ("schoolId" = current_setting('app.current_tenant', true));

-- Existing schools that already ran the old auto-billing keep their charges,
-- but so the switch doesn't strand them, backfill an activation for every
-- class-month that already has monthly charges. New months still require an
-- explicit setup.
INSERT INTO "monthly_fee_activations" ("id", "schoolId", "year", "month", "classId", "activatedAt")
SELECT
    gen_random_uuid()::text,
    s."schoolId",
    fc."year",
    fc."month",
    s."classId",
    now()
FROM "fee_charges" fc
JOIN "students" s ON s."id" = fc."studentId"
WHERE fc."kind" = 'MONTHLY'
GROUP BY s."schoolId", fc."year", fc."month", s."classId";
