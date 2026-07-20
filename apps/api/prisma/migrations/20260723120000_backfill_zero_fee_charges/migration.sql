-- Backfill: monthly fee charges of $0 (a waived/free student) that were
-- created before the app understood "nothing owed" as distinct from "unpaid"
-- were left at the default UNPAID status. Those students showed as owing
-- money for every single month and could be swept into outstanding-balance
-- reports and fee-reminder SMS runs meant for families who actually owe
-- something.
--
-- Scoped tightly on purpose:
--   kind = 'MONTHLY'            — the four creation sites this bug came from
--   amount = 0                  — only genuinely free/waived months
--   status IN ('UNPAID','PARTIAL') — never touches INACTIVE rows, which also
--                                     carry amount = 0 but mean something
--                                     different (before the student's billing
--                                     start, not "nothing owed this month")
UPDATE "fee_charges"
SET "status" = 'PAID', "updatedAt" = now()
WHERE "kind" = 'MONTHLY'
  AND "amount" = 0
  AND "status" IN ('UNPAID', 'PARTIAL');
