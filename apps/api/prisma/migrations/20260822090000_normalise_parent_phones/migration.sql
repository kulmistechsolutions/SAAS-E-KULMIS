-- Put every parent phone into one canonical form (252XXXXXXXXX), and merge the
-- duplicate parents that inconsistent formatting created.
--
-- Numbers were only normalised at SMS-send time, so the same parent written
-- 0615…, +252615… and 615… became three separate rows — parent matching keys on
-- an exact phone string. 1,379 of 1,673 parents were stored non-canonically.
--
-- NOTHING IS DELETED. Duplicates are marked INACTIVE and keep their original
-- number; their students are moved to the surviving record first. Numbers that
-- cannot be repaired (a lost operator prefix, two numbers in one cell) are left
-- exactly as they are — this migration must not invent a number that was never
-- recorded. Both tables are snapshotted first so the whole thing is reversible.

-- ── 0. Backups ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "parents_phone_backup_20260822" AS
  SELECT id, "schoolId", phone, status, now() AS backed_up_at FROM "parents";

CREATE TABLE IF NOT EXISTS "students_parent_backup_20260822" AS
  SELECT id, "parentId", now() AS backed_up_at FROM "students";

-- ── 1. Canonical form, and the merge plan ─────────────────────────────────
CREATE TEMP TABLE _canon AS
SELECT p.id, p."schoolId", p.phone, p."createdAt",
  CASE
    WHEN regexp_replace(p.phone,'\D','','g') ~ '^00252\d{9}$' THEN substring(regexp_replace(p.phone,'\D','','g') from 3)
    WHEN regexp_replace(p.phone,'\D','','g') ~ '^252\d{9}$'   THEN regexp_replace(p.phone,'\D','','g')
    WHEN regexp_replace(p.phone,'\D','','g') ~ '^0\d{9}$'     THEN '252'||substring(regexp_replace(p.phone,'\D','','g') from 2)
    WHEN regexp_replace(p.phone,'\D','','g') ~ '^\d{9}$'      THEN '252'||regexp_replace(p.phone,'\D','','g')
    ELSE NULL                    -- unrepairable: left untouched below
  END AS canon
FROM "parents" p;

-- The survivor is whichever row ALREADY holds the canonical number, else the
-- oldest. Choosing it that way means the survivor never has to take a value a
-- sibling still holds, so the (schoolId, phone) unique constraint is never
-- violated part-way through.
CREATE TEMP TABLE _survivor AS
SELECT "schoolId", canon,
       (array_agg(id ORDER BY (phone = canon) DESC, "createdAt" ASC))[1] AS keep_id
FROM _canon
WHERE canon IS NOT NULL
GROUP BY "schoolId", canon
HAVING count(*) > 1;

CREATE TEMP TABLE _merge AS
SELECT c.id AS lose_id, s.keep_id
FROM _canon c
JOIN _survivor s ON s."schoolId" = c."schoolId" AND s.canon = c.canon
WHERE c.id <> s.keep_id;

-- ── 2. Move the children onto the surviving parent ────────────────────────
UPDATE "students" s
SET "parentId" = m.keep_id
FROM _merge m
WHERE s."parentId" = m.lose_id;

-- ── 3. Keep any detail only the duplicate had ─────────────────────────────
UPDATE "parents" k SET
  "altPhone"  = COALESCE(k."altPhone",  l."altPhone"),
  email       = COALESCE(k.email,       l.email),
  address     = COALESCE(k.address,     l.address),
  occupation  = COALESCE(k.occupation,  l.occupation),
  "updatedAt" = now()
FROM _merge m
JOIN "parents" l ON l.id = m.lose_id
WHERE k.id = m.keep_id;

-- ── 4. Retire the duplicates (kept, not deleted; original number retained) ─
UPDATE "parents" SET status = 'INACTIVE', "updatedAt" = now()
WHERE id IN (SELECT lose_id FROM _merge);

-- ── 5. Canonicalise everyone still active and repairable ──────────────────
UPDATE "parents" p
SET phone = c.canon, "updatedAt" = now()
FROM _canon c
WHERE p.id = c.id
  AND c.canon IS NOT NULL
  AND p.phone <> c.canon
  AND p.id NOT IN (SELECT lose_id FROM _merge);
