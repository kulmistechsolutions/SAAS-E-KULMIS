-- What a school spends is not always a whole unit.
--
-- `expenses.amount` was an integer, so 0.50 could not be entered at all and
-- 12.75 would have had to be rounded. Numeric(14,2) is the money type: exact
-- under addition, unlike a float, and wide enough for any school's ledger.
--
-- Every existing row is a whole number and converts without loss; the cast is
-- widening, so nothing already recorded changes value.
ALTER TABLE "expenses"
  ALTER COLUMN "amount" TYPE numeric(14,2) USING "amount"::numeric(14,2);
