-- DropForeignKey
ALTER TABLE "application_documents" DROP CONSTRAINT "application_documents_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_applicantId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "receipts" DROP CONSTRAINT "receipts_invoiceId_fkey";

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
