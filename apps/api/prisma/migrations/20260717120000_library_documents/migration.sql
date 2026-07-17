-- Library PDF documents: books/notes a school uploads for students to read in
-- their portal. Tenant-scoped with Row-Level Security like every other table.
-- Also adds the per-plan library storage allowance.

-- 1. Table.
CREATE TABLE IF NOT EXISTS "library_documents" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "author" TEXT,
  -- NULL = readable by every student in the school; set = that class only.
  "classId" TEXT,
  "fileKey" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "allowDownload" BOOLEAN NOT NULL DEFAULT false,
  "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "library_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "library_documents_schoolId_idx" ON "library_documents" ("schoolId");
CREATE INDEX IF NOT EXISTS "library_documents_classId_idx" ON "library_documents" ("classId");

-- 2. Foreign key. RESTRICT (not SET NULL) on purpose: a class-locked book must
-- never silently become school-wide readable because its class was deleted.
ALTER TABLE "library_documents"
  ADD CONSTRAINT "library_documents_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Row-Level Security (tenant isolation).
ALTER TABLE "library_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "library_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_library_documents ON "library_documents"
  USING ("schoolId" = current_setting('app.current_tenant', true))
  WITH CHECK ("schoolId" = current_setting('app.current_tenant', true));

-- 4. Grant the restricted runtime role access (RLS still applies).
GRANT SELECT, INSERT, UPDATE, DELETE ON "library_documents" TO app_user;

-- 5. Per-plan library storage allowance (NULL = unlimited), platform-level table.
ALTER TABLE "subscription_plans"
  ADD COLUMN IF NOT EXISTS "libraryStorageMb" INTEGER;
