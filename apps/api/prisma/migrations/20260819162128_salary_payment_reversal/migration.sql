CREATE TYPE "SalaryPaymentStatus" AS ENUM ('ACTIVE', 'REVERSED');

ALTER TABLE "salary_payments" ADD COLUMN "status" "SalaryPaymentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "salary_payments" ADD COLUMN "isReversal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "salary_payments" ADD COLUMN "reversalOfPaymentId" TEXT;
ALTER TABLE "salary_payments" ADD COLUMN "reversedAt" TIMESTAMP(3);
ALTER TABLE "salary_payments" ADD COLUMN "reversedByUserId" TEXT;
ALTER TABLE "salary_payments" ADD COLUMN "reversalReason" TEXT;

CREATE UNIQUE INDEX "salary_payments_reversalOfPaymentId_key" ON "salary_payments"("reversalOfPaymentId");

ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_reversalOfPaymentId_fkey"
  FOREIGN KEY ("reversalOfPaymentId") REFERENCES "salary_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
