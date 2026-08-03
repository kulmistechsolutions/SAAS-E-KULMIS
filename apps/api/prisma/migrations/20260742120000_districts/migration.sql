-- District becomes a real school-managed list, mirroring Village exactly,
-- instead of the free-text column added in the previous migration. That
-- column turned out NOT to be empty everywhere — at least one live school
-- had already registered real students with a district typed in — so this
-- migration converts each distinct (school, district name) into a real row
-- and re-points every student at it, rather than assuming it's safe to drop.
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "districts_schoolId_name_key" ON "districts"("schoolId", "name");
CREATE INDEX "districts_schoolId_idx" ON "districts"("schoolId");

ALTER TABLE "districts" ADD CONSTRAINT "districts_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS, like every other tenant table (villages included).
ALTER TABLE "districts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "districts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_districts ON "districts"
    USING ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "students" ADD COLUMN "districtId" TEXT;

-- Backfill: one District row per distinct (school, name) already typed into
-- the free-text column, then link every student that had a value to it.
INSERT INTO "districts" ("id", "schoolId", "name", "orderIndex", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."schoolId", t.district, 0, 'ACTIVE', now(), now()
FROM (SELECT DISTINCT "schoolId", district FROM "students" WHERE district IS NOT NULL) t
ON CONFLICT ("schoolId", "name") DO NOTHING;

UPDATE "students" s
SET "districtId" = d."id"
FROM "districts" d
WHERE s.district IS NOT NULL
  AND d."schoolId" = s."schoolId"
  AND d."name" = s.district;

ALTER TABLE "students" DROP COLUMN "district";

CREATE INDEX "students_districtId_idx" ON "students"("districtId");
ALTER TABLE "students" ADD CONSTRAINT "students_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "schools"
  ADD COLUMN "villageRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "districtRequired" BOOLEAN NOT NULL DEFAULT false;
