-- One-time correction. The monthly_fee_activation migration backfilled an
-- activation for EVERY class-month that already had charges — including the
-- current month (July 2026). But the current month is exactly what each school
-- must now turn on for itself: billing must never look "already set up" for a
-- month nobody deliberately activated.
--
-- So remove the activations for the current month and anything later, and clear
-- the auto-generated charges for those months that never collected any money
-- (paidAmount = 0). Charges that DID collect money are kept — they are real
-- financial records, and re-running the setup skips those students anyway.
--
-- Past, settled months keep their activations so history and reports are intact.

DELETE FROM "monthly_fee_activations"
WHERE ("year", "month") >= (2026, 7);

DELETE FROM "fee_charges"
WHERE ("year", "month") >= (2026, 7)
  AND "kind" = 'MONTHLY'
  AND "paidAmount" = 0;
