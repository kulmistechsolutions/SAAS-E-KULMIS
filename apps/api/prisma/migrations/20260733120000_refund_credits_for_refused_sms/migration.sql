-- Give back credits charged for messages that were never delivered.
--
-- Two sends were refused by Hormuud but recorded as SENT, so the credit each
-- consumed was never returned. They are labelled FAILED now, but the credits
-- stayed spent. Later refusals refund correctly; these predate that fix.
--
-- Mirrors what refundCredits() does: put the credits back on the purchase,
-- write a REFUND transaction against the message, and zero creditsUsed.
--
-- Kept as separate statements on purpose. Data-modifying CTEs all read the
-- same snapshot, so a balance computed alongside the restore in one statement
-- would record the pre-refund figure.

CREATE TEMPORARY TABLE owed_refunds ON COMMIT DROP AS
SELECT m.id, m."schoolId", m."purchaseId", m."creditsUsed" AS credits
FROM sms_messages m
WHERE m.status = 'FAILED'
  AND m."creditsUsed" > 0
  AND m."purchaseId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sms_transactions t
    WHERE t."messageId" = m.id AND t.type = 'REFUND'
  );

UPDATE sms_purchases p
SET "creditsRemaining" = p."creditsRemaining" + s.total,
    status = 'ACTIVE'
FROM (
  SELECT "purchaseId", SUM(credits) AS total
  FROM owed_refunds GROUP BY "purchaseId"
) s
WHERE p.id = s."purchaseId";

INSERT INTO sms_transactions
  (id, "schoolId", "purchaseId", type, credits, "balanceAfter",
   description, "messageId", "createdAt")
SELECT
  'refund_' || o.id,
  o."schoolId",
  o."purchaseId",
  'REFUND',
  o.credits,
  (SELECT COALESCE(SUM(p2."creditsRemaining"), 0)
   FROM sms_purchases p2
   WHERE p2."schoolId" = o."schoolId" AND p2.status = 'ACTIVE'),
  'Refund for failed SMS ' || o.id,
  o.id,
  NOW()
FROM owed_refunds o;

UPDATE sms_messages
SET "creditsUsed" = 0
WHERE id IN (SELECT id FROM owed_refunds);
