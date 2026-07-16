-- Per-document header/footer text and a global logo/header layout choice.

ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "documentHeaderLayout" TEXT NOT NULL DEFAULT 'LEFT',
  ADD COLUMN IF NOT EXISTS "receiptHeader" TEXT,
  ADD COLUMN IF NOT EXISTS "payslipHeader" TEXT,
  ADD COLUMN IF NOT EXISTS "payslipFooter" TEXT,
  ADD COLUMN IF NOT EXISTS "expenseHeader" TEXT,
  ADD COLUMN IF NOT EXISTS "expenseFooter" TEXT,
  ADD COLUMN IF NOT EXISTS "studentHeader" TEXT,
  ADD COLUMN IF NOT EXISTS "studentFooter" TEXT,
  ADD COLUMN IF NOT EXISTS "teacherHeader" TEXT,
  ADD COLUMN IF NOT EXISTS "teacherFooter" TEXT,
  ADD COLUMN IF NOT EXISTS "parentHeader" TEXT,
  ADD COLUMN IF NOT EXISTS "parentFooter" TEXT,
  ADD COLUMN IF NOT EXISTS "reportHeader" TEXT;
