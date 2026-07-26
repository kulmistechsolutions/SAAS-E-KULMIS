-- Third and final wording for code 203: state the refusal, diagnose nothing.
--
-- The rows have carried two causes now, both disproved by a later send. The
-- sender name was blamed, then a message under a name that had worked ten
-- times was refused. The recipient was blamed, then a second number that had
-- worked was refused too. What is established is only that Hormuud refused
-- the message, so that is all the log should claim.

UPDATE sms_messages
SET error =
  'Hormuud refused this message (code 203) and gave no reason. '
  || 'If messages to every number are failing, sending on the Hormuud '
  || 'account is the thing to check — authentication and balance can still '
  || 'look healthy while sending is refused. Contact Hormuud with the date, '
  || 'the sending name and a refused number.'
WHERE "providerCode" = '203';
