-- Replace an explanation that named the wrong cause.
--
-- Code 203 rows were labelled "the sender name is not registered with the
-- operator". The send log refutes that: all four 203s went to one number,
-- the same sending name reached nine other numbers, and the refused number
-- had itself received eleven messages earlier. The wording now points at the
-- number and leaves the rest as things to check.
--
-- Only the explanatory text changes. Status, provider code and provider
-- message are untouched.

UPDATE sms_messages
SET error =
  'Hormuud refused this message (code 203). It is usually the number: '
  || 'check it is correct, in service, and able to receive messages from a '
  || 'business sender. If other numbers are failing too, check the sending '
  || 'name is registered with Hormuud for this account.'
WHERE "providerCode" = '203'
  AND error LIKE '%sender name is not registered%';
