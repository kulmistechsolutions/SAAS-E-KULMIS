-- A school-defined list of neighborhoods/villages, offered as an optional
-- field on student registration. General-purpose — every school gets this
-- table, independent of the custom academic structure. Additive: the new
-- Student.villageId column is nullable, so every existing student is
-- unaffected until re-saved.

CREATE TABLE "villages" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "villages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "villages_schoolId_name_key" ON "villages"("schoolId", "name");
CREATE INDEX "villages_schoolId_idx" ON "villages"("schoolId");

ALTER TABLE "villages"
    ADD CONSTRAINT "villages_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "students" ADD COLUMN "villageId" TEXT;
CREATE INDEX "students_villageId_idx" ON "students"("villageId");

ALTER TABLE "students"
    ADD CONSTRAINT "students_villageId_fkey"
    FOREIGN KEY ("villageId") REFERENCES "villages"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS, like every other tenant table.
ALTER TABLE "villages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "villages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_villages ON "villages"
    USING ("schoolId" = current_setting('app.current_tenant', true));
