-- Free-trial deadline for a newly created school. Until it passes the school
-- works normally without a subscription; after it, sign-in is blocked.
-- Null = no trial was granted (existing schools are unaffected).
ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
