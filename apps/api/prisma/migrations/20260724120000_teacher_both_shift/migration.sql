-- A teacher who works both the morning and afternoon shift needs a real value
-- to say so on their own profile.
--
-- Split into its own migration on purpose: Postgres will not let a
-- newly-added enum value be USED (e.g. in a CHECK constraint) inside the same
-- transaction it was added in — "unsafe use of new value ... New enum values
-- must be committed before they can be used." The next migration is where
-- 'BOTH' actually gets referenced.
ALTER TYPE "Shift" ADD VALUE IF NOT EXISTS 'BOTH';
