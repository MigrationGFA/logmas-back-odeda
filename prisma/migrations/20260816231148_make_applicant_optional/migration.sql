-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'user_reactivated';
ALTER TYPE "AuditAction" ADD VALUE 'pricing_updated';
ALTER TYPE "AuditAction" ADD VALUE 'complaint_logged';
ALTER TYPE "AuditAction" ADD VALUE 'complaint_assigned';
ALTER TYPE "AuditAction" ADD VALUE 'complaint_resolved';

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_applicantId_fkey";

-- AlterTable
ALTER TABLE "application_documents" ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "mimeType" TEXT;

-- AlterTable
ALTER TABLE "applications" ALTER COLUMN "applicantId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
