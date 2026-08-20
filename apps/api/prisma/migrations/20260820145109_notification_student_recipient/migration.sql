ALTER TABLE "notifications" ADD COLUMN "studentId" TEXT;

CREATE INDEX "notifications_studentId_idx" ON "notifications"("studentId");
