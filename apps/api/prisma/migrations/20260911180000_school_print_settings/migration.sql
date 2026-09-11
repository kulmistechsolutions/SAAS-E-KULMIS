-- Which design each kind of printed document uses, per school.
--
-- One nullable JSON column, exactly like the seven settings sections beside
-- it. Null means "this school has never chosen", which is every school today,
-- so nothing changes for anyone until an administrator picks something.
--
-- No existing record is touched: this stores presentation, never data. A
-- receipt printed in September stays the receipt it was.
ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "printSettings" JSONB;
