-- Correct the recorded type on payments taken before the fix.
--
-- The type used to be whichever button the clerk pressed, not what the money
-- settled: clearing August in full through the arrears line was written down
-- as PARTIAL, and so was clearing a family's whole balance. Schools read that
-- column to find who still owes.
--
-- 269 rows are wrong. This recomputes each one from the charges it actually
-- settled, using the month that was live ON THE DAY THE PAYMENT WAS TAKEN --
-- not today's. That distinction matters: a payment made in August that
-- settled August was correctly "This Month" then, and relabelling it now
-- because September has since opened would only be a different falsehood.
--
-- Nothing but the label changes. No balance, charge or allocation is touched,
-- and reversals and reversed originals are left alone. The previous values
-- are snapshotted first and the table is kept, not dropped.
--
-- Run it as:
--   docker exec -i <postgres-container> psql -U postgres -d ekulmis < fix-payment-labels.sql

BEGIN;

CREATE TABLE IF NOT EXISTS "payments_type_backup_20260906" AS
  SELECT id, "schoolId", "receiptNumber", type AS old_type, now() AS backed_up_at
  FROM "payments";

CREATE TEMP TABLE _recls AS
WITH alloc AS (
  SELECT a."paymentId", a."feeChargeId", a.amount, c.year, c.month,
         c.amount AS charge_amount, p."paidAt", p."schoolId", p.type
  FROM payment_allocations a
  JOIN fee_charges c ON c.id = a."feeChargeId"
  JOIN payments p ON p.id = a."paymentId"
  WHERE p."isReversal" = false AND p.status <> 'REVERSED'
), running AS (
  -- What the charge stood at immediately after THIS payment, not today.
  SELECT *, SUM(amount) OVER (
      PARTITION BY "feeChargeId" ORDER BY "paidAt", "paymentId"
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS paid_after
  FROM alloc
), pay_live AS (
  -- liveMonth() as it stood on the day of the payment: the latest activation
  -- among that calendar month and the one before it.
  SELECT DISTINCT p.id AS payment_id,
    COALESCE((
      SELECT m.year*100+m.month FROM monthly_fee_activations m
      WHERE m."schoolId" = p."schoolId"
        AND (m.year*100+m.month) IN (
          EXTRACT(YEAR FROM p."paidAt")::int*100 + EXTRACT(MONTH FROM p."paidAt")::int,
          EXTRACT(YEAR FROM (p."paidAt" - interval '1 month'))::int*100
            + EXTRACT(MONTH FROM (p."paidAt" - interval '1 month'))::int)
      ORDER BY m.year DESC, m.month DESC LIMIT 1),
      EXTRACT(YEAR FROM p."paidAt")::int*100 + EXTRACT(MONTH FROM p."paidAt")::int
    ) AS live_ym
  FROM payments p WHERE p."isReversal" = false AND p.status <> 'REVERSED'
)
SELECT r."paymentId" AS id, r.type AS old_type,
  (CASE WHEN bool_or(r.paid_after < r.charge_amount) THEN 'PARTIAL'
        WHEN max(r.year*100+r.month) > pl.live_ym THEN 'ADVANCE'
        WHEN bool_or(r.year*100+r.month = pl.live_ym) THEN 'THIS_MONTH'
        ELSE 'ARREARS' END)::"PaymentType" AS new_type
FROM running r JOIN pay_live pl ON pl.payment_id = r."paymentId"
GROUP BY r."paymentId", r.type, pl.live_ym;

UPDATE "payments" p SET type = x.new_type
FROM _recls x WHERE p.id = x.id AND p.type <> x.new_type;

-- What changed, for the record.
SELECT old_type, new_type, count(*)
FROM _recls WHERE old_type <> new_type GROUP BY 1,2 ORDER BY 1,2;

COMMIT;
