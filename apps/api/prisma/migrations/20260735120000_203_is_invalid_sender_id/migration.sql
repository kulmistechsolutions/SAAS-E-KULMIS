-- Record what code 203 actually means.
--
-- Hormuud returns it as `Data.Description: "Invalid Sender ID!!"`, a field the
-- client was discarding. Confirmed by probing four sending names against the
-- live account -- "KULMISTECH", "KULMIS TECH SCHOOL", "DUGSIGA HOOSE DHEXE"
-- and "eKulmis" -- every one refused, including two that had delivered
-- messages days earlier.

UPDATE sms_messages
SET error =
  'Hormuud rejected the sending name (code 203 - Invalid Sender ID). '
  || 'The name messages go out under must be registered with Hormuud for '
  || 'this account. A name that worked before can stop being accepted, so '
  || 'confirm the registration with Hormuud.',
  "providerMessage" = 'Invalid Sender ID!!'
WHERE "providerCode" = '203';
