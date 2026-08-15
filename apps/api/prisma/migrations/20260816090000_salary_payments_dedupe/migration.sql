-- Real partial-payment tracking for payroll (previously the individual
-- payment amount was kept client-side only, so amountPaid silently reset to
-- 0 on every reload while status still said PARTIAL).
ALTER TABLE "salaries" ADD COLUMN "amountPaid" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "salary_payments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "salaryId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT,
    "note" TEXT,
    "collectedByUserId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "salary_payments_schoolId_idx" ON "salary_payments"("schoolId");
CREATE INDEX "salary_payments_salaryId_idx" ON "salary_payments"("salaryId");

ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_salaryId_fkey"
  FOREIGN KEY ("salaryId") REFERENCES "salaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Generate Payroll had no server-side guard against duplicate rows for the
-- same person+month (only a client-side check against possibly-stale local
-- state), so clicking it twice — or two admins doing it around the same
-- time — created duplicates. Dedupe existing data before the unique
-- constraints below make that impossible going forward: for each set of
-- duplicates, keep the one with the most progress (PAID, then PARTIAL, then
-- the oldest row) and drop the rest.
WITH ranked_teacher AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "schoolId", "teacherId", "year", "month"
    ORDER BY (status = 'PAID') DESC, (status = 'PARTIAL') DESC, "createdAt" ASC
  ) AS rn
  FROM "salaries"
  WHERE "teacherId" IS NOT NULL
)
DELETE FROM "salaries" WHERE id IN (SELECT id FROM ranked_teacher WHERE rn > 1);

WITH ranked_employee AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "schoolId", "employeeId", "year", "month"
    ORDER BY (status = 'PAID') DESC, (status = 'PARTIAL') DESC, "createdAt" ASC
  ) AS rn
  FROM "salaries"
  WHERE "employeeId" IS NOT NULL
)
DELETE FROM "salaries" WHERE id IN (SELECT id FROM ranked_employee WHERE rn > 1);

CREATE UNIQUE INDEX "salaries_schoolId_teacherId_year_month_key" ON "salaries"("schoolId", "teacherId", "year", "month");
CREATE UNIQUE INDEX "salaries_schoolId_employeeId_year_month_key" ON "salaries"("schoolId", "employeeId", "year", "month");
