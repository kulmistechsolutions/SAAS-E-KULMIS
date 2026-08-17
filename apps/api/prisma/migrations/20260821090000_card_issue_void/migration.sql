-- Voiding a card record (issued in error, wrong batch, wrong template).
--
-- The row is kept and marked CANCELLED rather than deleted: a school must be
-- able to see that a card was issued and then cancelled. Deleting it would let
-- the log quietly disagree with what was actually handed out, which is the one
-- thing an audit trail must not do.
ALTER TABLE "card_issues" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "card_issues" ADD COLUMN "voidedAt" TIMESTAMP(3);
