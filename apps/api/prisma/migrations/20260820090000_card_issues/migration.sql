-- Generation history and reprints for the ID Generator (PRD §24-27).
--
-- Student name and code are stored on the row rather than only referenced: the
-- history has to stay readable years later even if the student is renamed, and
-- the code recorded here is the permanent ID that was actually printed.
CREATE TABLE "card_issues" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "orientation" TEXT NOT NULL,
    "academicYear" TEXT,
    "className" TEXT,
    "section" TEXT,
    "batchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "isReprint" BOOLEAN NOT NULL DEFAULT false,
    "reprintOfId" TEXT,
    "reprintReason" TEXT,
    "issuedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "card_issues_schoolId_idx" ON "card_issues"("schoolId");
CREATE INDEX "card_issues_schoolId_batchId_idx" ON "card_issues"("schoolId", "batchId");
CREATE INDEX "card_issues_studentId_idx" ON "card_issues"("studentId");

ALTER TABLE "card_issues" ADD CONSTRAINT "card_issues_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same forced tenant isolation as every other school-scoped table.
ALTER TABLE "card_issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "card_issues" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_card_issues ON "card_issues"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));
