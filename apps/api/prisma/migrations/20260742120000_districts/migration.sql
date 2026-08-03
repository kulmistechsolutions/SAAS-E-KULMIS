-- District becomes a real school-managed list, mirroring Village exactly,
-- instead of the free-text column added in the previous migration. Safe to
-- drop that column outright: it shipped with the DETAILED form only hours
-- ago and no production student has a value in it yet.
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

ALTER TABLE "students" DROP COLUMN "district";
ALTER TABLE "students" ADD COLUMN "districtId" TEXT;
CREATE INDEX "students_districtId_idx" ON "students"("districtId");
ALTER TABLE "students" ADD CONSTRAINT "students_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "schools"
  ADD COLUMN "villageRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "districtRequired" BOOLEAN NOT NULL DEFAULT false;
