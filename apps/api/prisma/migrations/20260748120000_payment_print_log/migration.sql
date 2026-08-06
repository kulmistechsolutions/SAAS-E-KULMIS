-- Track receipt/invoice print events so a school can see how many receipts
-- have actually been printed, not just recorded — one row per print click.

CREATE TABLE "payment_print_logs" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "printedByUserId" TEXT,
  "printedByUsername" TEXT,
  "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_print_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_print_logs_schoolId_idx" ON "payment_print_logs"("schoolId");
CREATE INDEX "payment_print_logs_paymentId_idx" ON "payment_print_logs"("paymentId");
CREATE INDEX "payment_print_logs_schoolId_printedAt_idx" ON "payment_print_logs"("schoolId", "printedAt");

ALTER TABLE "payment_print_logs"
  ADD CONSTRAINT "payment_print_logs_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS, like every other tenant table.
ALTER TABLE "payment_print_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_print_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payment_print_logs ON "payment_print_logs"
    USING ("schoolId" = current_setting('app.current_tenant', true));
