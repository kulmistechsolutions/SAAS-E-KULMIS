-- Payment promises: a parent's commitment to pay by a future date, recorded
-- when reception collects fees but the parent can't pay today. Purely a
-- reminder — never touches fee_charges/payments on its own — surfaced back
-- to staff via a banner on the Finance pages.
CREATE TYPE "PaymentPromiseStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED', 'MISSED');

CREATE TABLE "payment_promises" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "promisedDate" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "amount" INTEGER,
    "status" "PaymentPromiseStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_promises_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_promises_schoolId_idx" ON "payment_promises"("schoolId");
CREATE INDEX "payment_promises_studentId_idx" ON "payment_promises"("studentId");
CREATE INDEX "payment_promises_schoolId_status_promisedDate_idx" ON "payment_promises"("schoolId", "status", "promisedDate");

ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_promises" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_promises" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payment_promises ON "payment_promises"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
