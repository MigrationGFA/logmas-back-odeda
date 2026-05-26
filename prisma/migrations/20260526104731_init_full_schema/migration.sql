/*
  Warnings:

  - The values [pending] on the enum `PermitStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `details` column on the `audit_logs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `customerName` on the `complaints` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `complaints` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `permits` table. All the data in the column will be lost.
  - You are about to drop the column `qrTokenToken` on the `permits` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `permits` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `permits` table. All the data in the column will be lost.
  - You are about to drop the column `councillor` on the `wards` table. All the data in the column will be lost.
  - You are about to drop the column `councillorPhone` on the `wards` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ticketNumber]` on the table `complaints` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[qrToken]` on the table `permits` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[invoiceId]` on the table `permits` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `action` on the `audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `raisedById` to the `complaints` table without a default value. This is not possible if the table is not empty.
  - The required column `ticketNumber` was added to the `complaints` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `businessId` to the `permits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `permits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `permitType` to the `permits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qrToken` to the `permits` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'submitted', 'payment_pending', 'paid', 'under_review', 'forwarded_to_councillor', 'approved', 'rejected', 'certificate_issued');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('online_gateway', 'bank_transfer', 'virtual_account', 'pos', 'cash');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'confirmed', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "RevenueCategory" AS ENUM ('trade_permit', 'market_levy', 'environmental_levy', 'signage', 'parking_levy', 'haulage_levy', 'lockup_store_levy', 'business_levy', 'event_permit', 'state_of_origin_fee', 'other');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('one_time', 'daily', 'weekly', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('sms', 'email', 'whatsapp', 'in_app');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('login', 'logout', 'login_failed', 'invoice_created', 'invoice_edited', 'payment_confirmed', 'payment_reversed', 'receipt_generated', 'receipt_verified', 'permit_issued', 'permit_revoked', 'application_submitted', 'application_approved', 'application_rejected', 'certificate_issued', 'user_created', 'user_updated', 'user_deleted', 'pricing_updated', 'complaint_raised', 'complaint_assigned', 'complaint_resolved');

-- AlterEnum
BEGIN;
CREATE TYPE "PermitStatus_new" AS ENUM ('draft', 'pending_payment', 'paid', 'issued', 'expired', 'revoked');
ALTER TABLE "public"."permits" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "permits" ALTER COLUMN "status" TYPE "PermitStatus_new" USING ("status"::text::"PermitStatus_new");
ALTER TYPE "PermitStatus" RENAME TO "PermitStatus_old";
ALTER TYPE "PermitStatus_new" RENAME TO "PermitStatus";
DROP TYPE "public"."PermitStatus_old";
ALTER TABLE "permits" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'ward_councillor';
ALTER TYPE "Role" ADD VALUE 'agent';
ALTER TYPE "Role" ADD VALUE 'business_owner';

-- DropForeignKey
ALTER TABLE "permits" DROP CONSTRAINT "permits_userId_fkey";

-- DropIndex
DROP INDEX "permits_qrTokenToken_key";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "entity" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "userAgent" TEXT,
DROP COLUMN "action",
ADD COLUMN     "action" "AuditAction" NOT NULL,
DROP COLUMN "details",
ADD COLUMN     "details" JSONB;

-- AlterTable
ALTER TABLE "complaints" DROP COLUMN "customerName",
DROP COLUMN "phone",
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "raisedById" TEXT NOT NULL,
ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "ticketNumber" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "permits" DROP COLUMN "description",
DROP COLUMN "qrTokenToken",
DROP COLUMN "title",
DROP COLUMN "userId",
ADD COLUMN     "businessId" TEXT NOT NULL,
ADD COLUMN     "category" "RevenueCategory" NOT NULL,
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "issuedById" TEXT,
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "permitType" TEXT NOT NULL,
ADD COLUMN     "qrToken" TEXT NOT NULL,
ADD COLUMN     "validFrom" TIMESTAMP(3),
ADD COLUMN     "validTo" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "contractorId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "nin" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "supervisorId" TEXT,
ADD COLUMN     "wardId" TEXT;

-- AlterTable
ALTER TABLE "wards" DROP COLUMN "councillor",
DROP COLUMN "councillorPhone",
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "state_of_origin_applications" (
    "id" TEXT NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passportUrl" TEXT,
    "nin" TEXT,
    "purpose" TEXT,
    "applicantId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "reviewedByAdminId" TEXT,
    "reviewedByAdminAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "approvedByCouncillorId" TEXT,
    "approvedByCouncillorAt" TIMESTAMP(3),
    "councillorNotes" TEXT,
    "rejectionReason" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "state_of_origin_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "applicationId" TEXT NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "cacNumber" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levy_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "RevenueCategory" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'one_time',
    "penaltyRate" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "configuredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "category" "RevenueCategory" NOT NULL,
    "description" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "penaltyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "levyConfigId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedOfficerId" TEXT,
    "businessId" TEXT,
    "virtualAccountNo" TEXT,
    "virtualAccountBank" TEXT,
    "virtualAccountRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "reference" TEXT NOT NULL,
    "gatewayRef" TEXT,
    "narration" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "invoiceId" TEXT NOT NULL,
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_responses" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complaintId" TEXT NOT NULL,

    CONSTRAINT "complaint_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failReason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "state_of_origin_applications_applicationNo_key" ON "state_of_origin_applications"("applicationNo");

-- CreateIndex
CREATE UNIQUE INDEX "state_of_origin_applications_invoiceId_key" ON "state_of_origin_applications"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificateNumber_key" ON "certificates"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verificationCode_key" ON "certificates"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_qrToken_key" ON "certificates"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_applicationId_key" ON "certificates"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_virtualAccountRef_key" ON "invoices"("virtualAccountRef");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receiptNumber_key" ON "receipts"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_verificationCode_key" ON "receipts"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_qrToken_key" ON "receipts"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_invoiceId_key" ON "receipts"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_ticketNumber_key" ON "complaints"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "permits_qrToken_key" ON "permits"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "permits_invoiceId_key" ON "permits"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "state_of_origin_applications" ADD CONSTRAINT "state_of_origin_applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "state_of_origin_applications" ADD CONSTRAINT "state_of_origin_applications_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "state_of_origin_applications" ADD CONSTRAINT "state_of_origin_applications_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "state_of_origin_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levy_configs" ADD CONSTRAINT "levy_configs_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_levyConfigId_fkey" FOREIGN KEY ("levyConfigId") REFERENCES "levy_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_responses" ADD CONSTRAINT "complaint_responses_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
