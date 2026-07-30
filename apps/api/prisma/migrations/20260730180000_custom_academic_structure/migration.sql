-- Custom academic structure: two optional tiers above Class, so an Arabic
-- school can build its own ladder (الإبتدائي → المستوى الأول → الفصل الخامس)
-- instead of the Grade 1–12 one.
--
-- Every column added here is nullable or defaulted, and both new tables start
-- empty, so a school that never turns this on is untouched.

CREATE TYPE "RepeatScope" AS ENUM ('CLASS', 'STAGE');

ALTER TABLE "schools"
    ADD COLUMN "customStructureEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "termsPerYear" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "repeatScope" "RepeatScope" NOT NULL DEFAULT 'CLASS';

-- ── Level: الإبتدائي / الإعدادي / الثانوي ──
CREATE TABLE "academic_levels" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_levels_schoolId_academicYearId_name_key"
    ON "academic_levels"("schoolId", "academicYearId", "name");
CREATE INDEX "academic_levels_schoolId_idx" ON "academic_levels"("schoolId");
CREATE INDEX "academic_levels_academicYearId_idx" ON "academic_levels"("academicYearId");

ALTER TABLE "academic_levels"
    ADD CONSTRAINT "academic_levels_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Stage: المستوى الأول / الثاني — groups the classes of one year ──
CREATE TABLE "academic_stages" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_stages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_stages_schoolId_levelId_name_key"
    ON "academic_stages"("schoolId", "levelId", "name");
CREATE INDEX "academic_stages_schoolId_idx" ON "academic_stages"("schoolId");
CREATE INDEX "academic_stages_levelId_idx" ON "academic_stages"("levelId");

ALTER TABLE "academic_stages"
    ADD CONSTRAINT "academic_stages_levelId_fkey"
    FOREIGN KEY ("levelId") REFERENCES "academic_levels"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Hang Class off them. SET NULL, not CASCADE: deleting a level must not
--    take the classes and their students with it. ──
ALTER TABLE "classes"
    ADD COLUMN "levelId" TEXT,
    ADD COLUMN "stageId" TEXT;

CREATE INDEX "classes_levelId_idx" ON "classes"("levelId");
CREATE INDEX "classes_stageId_idx" ON "classes"("stageId");

ALTER TABLE "classes"
    ADD CONSTRAINT "classes_levelId_fkey"
    FOREIGN KEY ("levelId") REFERENCES "academic_levels"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "classes"
    ADD CONSTRAINT "classes_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "academic_stages"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS, like every other tenant table.
ALTER TABLE "academic_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_levels" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_academic_levels ON "academic_levels"
    USING ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "academic_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_stages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_academic_stages ON "academic_stages"
    USING ("schoolId" = current_setting('app.current_tenant', true));
