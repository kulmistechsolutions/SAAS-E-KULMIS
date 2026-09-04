-- Money the school has borrowed, and what it has paid back.
--
-- Schools take loans — from a bank, from an owner, as supplier credit — and
-- until now there was nowhere to write that down. The obligation lived in
-- somebody's head, and the repayments went in as ordinary expenses if they
-- went in at all, so the finance page could not say what the school owed or
-- what it had already cleared.
--
-- The principal is not income. Borrowing does not make a school richer; the
-- repayments are what leave, and those are what reach net income.

CREATE TYPE "SchoolDebtStatus" AS ENUM ('OPEN', 'SETTLED', 'CANCELLED');

CREATE TABLE "school_debts" (
  "id"               TEXT NOT NULL,
  "schoolId"         TEXT NOT NULL,
  "lender"           TEXT NOT NULL,
  "purpose"          TEXT,
  "principal"        INTEGER NOT NULL,
  "reference"        TEXT,
  "takenAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt"            TIMESTAMP(3),
  "status"           "SchoolDebtStatus" NOT NULL DEFAULT 'OPEN',
  "note"             TEXT,
  "recordedByUserId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_debts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_debts_schoolId_idx" ON "school_debts"("schoolId");
CREATE INDEX "school_debts_schoolId_status_idx" ON "school_debts"("schoolId", "status");

CREATE TABLE "school_debt_repayments" (
  "id"               TEXT NOT NULL,
  "schoolId"         TEXT NOT NULL,
  "debtId"           TEXT NOT NULL,
  "amount"           INTEGER NOT NULL,
  "method"           TEXT,
  "reference"        TEXT,
  "note"             TEXT,
  "recordedByUserId" TEXT,
  "paidAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_debt_repayments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_debt_repayments_schoolId_idx" ON "school_debt_repayments"("schoolId");
CREATE INDEX "school_debt_repayments_debtId_idx" ON "school_debt_repayments"("debtId");

ALTER TABLE "school_debt_repayments"
  ADD CONSTRAINT "school_debt_repayments_debtId_fkey"
  FOREIGN KEY ("debtId") REFERENCES "school_debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation with the tables, not after somebody notices. A schoolId
-- column without RLS leaks across schools silently, which is exactly how
-- salary_payments once did.
ALTER TABLE "school_debts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school_debts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "school_debts_tenant_isolation" ON "school_debts"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "school_debts" TO app_user;

ALTER TABLE "school_debt_repayments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school_debt_repayments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "school_debt_repayments_tenant_isolation" ON "school_debt_repayments"
  USING ("schoolId" = current_setting('app.current_tenant', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "school_debt_repayments" TO app_user;
