-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateTable
CREATE TABLE "student_attendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "academicYearId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_attendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "shift" "Shift" NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_attendance_schoolId_date_idx" ON "student_attendance"("schoolId", "date");

-- CreateIndex
CREATE INDEX "student_attendance_classId_sectionId_date_idx" ON "student_attendance"("classId", "sectionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_schoolId_studentId_date_key" ON "student_attendance"("schoolId", "studentId", "date");

-- CreateIndex
CREATE INDEX "teacher_attendance_schoolId_date_idx" ON "teacher_attendance"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_attendance_schoolId_teacherId_date_key" ON "teacher_attendance"("schoolId", "teacherId", "date");

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_attendance" ADD CONSTRAINT "teacher_attendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Tenant isolation (RLS) ──
ALTER TABLE "student_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_attendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_student_attendance ON "student_attendance"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "teacher_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_attendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_teacher_attendance ON "teacher_attendance"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
