-- Every row already marked PAID under the old status-only flow was, by that
-- flow's own definition, paid in full — but amountPaid never existed until
-- the previous migration, so it defaulted to 0 on every one of them. Backfill
-- it to match `amount` so payslips/reports stop showing "Paid: $0" on
-- salaries that were genuinely paid. (PARTIAL rows are NOT touched here —
-- unlike PAID, "partial" never had a known amount under the old flow, so
-- there is nothing safe to backfill; those need a human to confirm the real
-- figure.)
UPDATE "salaries" SET "amountPaid" = "amount" WHERE "status" = 'PAID' AND "amountPaid" < "amount";
