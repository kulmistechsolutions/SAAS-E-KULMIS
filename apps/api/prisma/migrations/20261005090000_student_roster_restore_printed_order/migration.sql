-- Restore every class's S/N to the numbers schools had already printed.
--
-- Until 2026-10-04 the students list opened newest first and numbered its
-- rows, so the S/N a school saw — and printed, and read out to its students —
-- was the reverse of the order students were entered. The register order
-- introduced on 2026-10-04 counted from the first student entered instead,
-- which turned every class's numbering upside down: alihsanpiss had handed
-- out a printed Grade 8 list with STD0708 at 1 and STD0604 at 75, and the
-- system now said the opposite.
--
-- So every student who was already there when that change shipped is put
-- back in the order the school saw: newest first, exactly as printed. Anyone
-- registered or moved into a class since keeps their later place, at the end
-- — which is the rule the schools asked for. Nothing else about a student
-- changes; rosterAt exists only to order the register.
--
-- The cutoff is the moment that migration finished, read from Prisma's own
-- record, so this gives the same result wherever and whenever it runs.
UPDATE "students" st
SET "rosterAt" = TIMESTAMP '2000-01-01' + (t.cutoff - st."createdAt")
FROM (
  SELECT (finished_at AT TIME ZONE 'UTC') AS cutoff
  FROM "_prisma_migrations"
  WHERE migration_name = '20261004090000_student_roster_order'
    AND finished_at IS NOT NULL
  LIMIT 1
) t
WHERE st."createdAt" <= t.cutoff
  AND st."rosterAt" = st."createdAt";
