-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_years_schoolId_idx" ON "academic_years"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_schoolId_name_key" ON "academic_years"("schoolId", "name");

-- CreateIndex
CREATE INDEX "classes_schoolId_idx" ON "classes"("schoolId");

-- CreateIndex
CREATE INDEX "classes_academicYearId_idx" ON "classes"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "classes_schoolId_academicYearId_name_key" ON "classes"("schoolId", "academicYearId", "name");

-- CreateIndex
CREATE INDEX "sections_schoolId_idx" ON "sections"("schoolId");

-- CreateIndex
CREATE INDEX "sections_classId_idx" ON "sections"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "sections_schoolId_classId_name_key" ON "sections"("schoolId", "classId", "name");

-- CreateIndex
CREATE INDEX "subjects_schoolId_idx" ON "subjects"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_schoolId_name_key" ON "subjects"("schoolId", "name");

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one active academic year per school.
CREATE UNIQUE INDEX "academic_years_one_active_per_school"
  ON "academic_years"("schoolId") WHERE "isActive";

-- ── Tenant isolation (RLS) for all academic-structure tables ──
ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_years" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_academic_years ON "academic_years"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_classes ON "classes"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sections ON "sections"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subjects" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subjects ON "subjects"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
