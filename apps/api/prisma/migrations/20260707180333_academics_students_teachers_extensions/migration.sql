-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "hasSections" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "parents" ADD COLUMN     "address" TEXT,
ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "qualification" TEXT;

-- CreateTable
CREATE TABLE "class_subjects" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_subjects_schoolId_idx" ON "class_subjects"("schoolId");

-- CreateIndex
CREATE INDEX "class_subjects_classId_idx" ON "class_subjects"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "class_subjects_schoolId_classId_sectionId_subjectId_key" ON "class_subjects"("schoolId", "classId", "sectionId", "subjectId");

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security for the new tenant-scoped table (mirror existing pattern).
ALTER TABLE "class_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_subjects" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_class_subjects ON "class_subjects"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
