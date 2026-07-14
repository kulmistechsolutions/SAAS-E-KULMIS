-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMINISTRATOR';
ALTER TYPE "UserRole" ADD VALUE 'ACADEMIC_MANAGER';
ALTER TYPE "UserRole" ADD VALUE 'RECEPTION_OFFICER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "code" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);
