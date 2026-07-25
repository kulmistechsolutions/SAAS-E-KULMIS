-- Messages the operator refused were stored as SENT.
--
-- Hormuud answers a rejected send with ResponseCode 203 and MessageID "null"
-- -- the four-letter string, not JSON null -- and the client's truthiness
-- check read that string as a real message id. So the school saw "Sent" for
-- messages no parent ever received. The client now decides on the response
-- code; this corrects the rows written before that fix.
--
-- Only rows carrying an explicit failure code are touched. Nothing is deleted,
-- and credits are not adjusted: these sends were never charged for delivery.

UPDATE sms_messages
SET
  status = 'FAILED',
  "providerMessageId" = NULL,
  error = COALESCE(
    NULLIF(error, ''),
    CASE "providerCode"
      WHEN '203' THEN 'Rejected by Hormuud - the sender name is not registered with the operator for this account.'
      WHEN '204' THEN 'Rejected by Hormuud - invalid or unreachable recipient number.'
      WHEN '205' THEN 'Rejected by Hormuud - insufficient balance on the operator account.'
      ELSE 'Rejected by the provider (code ' || "providerCode" || ').'
    END
  )
WHERE
  status IN ('SENT', 'DELIVERED')
  AND "providerCode" IS NOT NULL
  AND "providerCode" NOT IN ('200', '0')
  AND lower("providerCode") <> 'success';

-- The same string leaked into rows that did succeed; a placeholder id is worse
-- than none, because it looks like something a delivery report could match.
UPDATE sms_messages
SET "providerMessageId" = NULL
WHERE lower(trim("providerMessageId")) IN ('null', 'undefined', '0', 'none', 'n/a', '');
