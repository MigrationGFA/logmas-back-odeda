-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
