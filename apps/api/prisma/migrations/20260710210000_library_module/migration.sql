-- Library module (Module 16): book catalogue + student loans, plus the
-- LIBRARIAN role. Tenant-scoped with Row-Level Security like every other table.

-- 1. New role value (safe to add; not used within this migration).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'LIBRARIAN';

-- 2. Loan status enum.
DO $$ BEGIN
  CREATE TYPE "LoanStatus" AS ENUM ('ISSUED', 'RETURNED', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Tables.
CREATE TABLE IF NOT EXISTS "books" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "isbn" TEXT,
  "category" TEXT,
  "totalCopies" INTEGER NOT NULL DEFAULT 1,
  "availableCopies" INTEGER NOT NULL DEFAULT 1,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "books_schoolId_idx" ON "books" ("schoolId");

CREATE TABLE IF NOT EXISTS "book_loans" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" DATE NOT NULL,
  "returnedAt" TIMESTAMP(3),
  "status" "LoanStatus" NOT NULL DEFAULT 'ISSUED',
  "issuedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "book_loans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "book_loans_schoolId_idx" ON "book_loans" ("schoolId");
CREATE INDEX IF NOT EXISTS "book_loans_bookId_idx" ON "book_loans" ("bookId");
CREATE INDEX IF NOT EXISTS "book_loans_studentId_idx" ON "book_loans" ("studentId");

-- 4. Foreign keys.
ALTER TABLE "book_loans"
  ADD CONSTRAINT "book_loans_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_loans"
  ADD CONSTRAINT "book_loans_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Row-Level Security (tenant isolation).
ALTER TABLE "books" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "books" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_books ON "books"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

ALTER TABLE "book_loans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "book_loans" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_book_loans ON "book_loans"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

-- 6. Grant the restricted runtime role access (RLS still applies).
GRANT SELECT, INSERT, UPDATE, DELETE ON "books" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "book_loans" TO app_user;
