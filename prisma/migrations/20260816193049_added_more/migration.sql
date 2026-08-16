/*
  Warnings:

  - You are about to drop the column `amountPaid` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `amountPayable` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `balanceDue` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `dueDate` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `penaltyAmount` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `qrToken` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `revenueHead` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `verificationCode` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `virtualAccountBank` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `virtualAccountNo` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `defaultFee` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `feeDescription` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `feeType` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `agentId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `assignedWardId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `commissionRate` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `contractorId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `idType` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isWalkIn` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `notifyByEmail` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `notifyByInApp` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `notifyBySms` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `passwordResetRequired` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `suspendedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `suspendedById` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `suspensionReason` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `walkInRegisteredById` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `wards` table. All the data in the column will be lost.
  - You are about to drop the `_ContractorWards` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `application_approvals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `field_inspections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_applications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_fee_schedules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `treasury_assessments` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[applicationId]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `services` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amount` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `applicationId` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `certificateType` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `services` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('CERTIFICATE_OF_ORIGIN', 'CLUB_REGISTRATION', 'CDA_REGISTRATION', 'FARMERS_REGISTRATION', 'ENVIRONMENTAL_SANITATION_COMPLIANCE', 'TENEMENT_RATE_CLEARANCE', 'HAULAGE_PERMIT', 'LIQUOR_LICENCE', 'VIEWING_CENTRE_LICENCE', 'QUARRY_PERMIT', 'STREET_NAMING_CERTIFICATE', 'KIOSK_LICENCE');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropForeignKey
ALTER TABLE "_ContractorWards" DROP CONSTRAINT "_ContractorWards_A_fkey";

-- DropForeignKey
ALTER TABLE "_ContractorWards" DROP CONSTRAINT "_ContractorWards_B_fkey";

-- DropForeignKey
ALTER TABLE "application_approvals" DROP CONSTRAINT "application_approvals_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "application_approvals" DROP CONSTRAINT "application_approvals_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "field_inspections" DROP CONSTRAINT "field_inspections_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "field_inspections" DROP CONSTRAINT "field_inspections_inspectorId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_createdById_fkey";

-- DropForeignKey
ALTER TABLE "service_applications" DROP CONSTRAINT "service_applications_applicantId_fkey";

-- DropForeignKey
ALTER TABLE "service_applications" DROP CONSTRAINT "service_applications_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "service_applications" DROP CONSTRAINT "service_applications_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "service_applications" DROP CONSTRAINT "service_applications_wardId_fkey";

-- DropForeignKey
ALTER TABLE "service_fee_schedules" DROP CONSTRAINT "service_fee_schedules_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "treasury_assessments" DROP CONSTRAINT "treasury_assessments_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "treasury_assessments" DROP CONSTRAINT "treasury_assessments_assessedById_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_agentId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_assignedWardId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_createdById_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_suspendedById_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_walkInRegisteredById_fkey";

-- DropIndex
DROP INDEX "invoices_qrToken_key";

-- DropIndex
DROP INDEX "invoices_verificationCode_key";

-- DropIndex
DROP INDEX "services_slug_key";

-- DropIndex
DROP INDEX "users_assignedWardId_key";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "amountPaid",
DROP COLUMN "amountPayable",
DROP COLUMN "balanceDue",
DROP COLUMN "createdById",
DROP COLUMN "description",
DROP COLUMN "dueDate",
DROP COLUMN "penaltyAmount",
DROP COLUMN "qrToken",
DROP COLUMN "revenueHead",
DROP COLUMN "status",
DROP COLUMN "verificationCode",
DROP COLUMN "virtualAccountBank",
DROP COLUMN "virtualAccountNo",
ADD COLUMN     "amount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "applicationId" TEXT NOT NULL,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "transactionRef" TEXT,
ADD COLUMN     "virtualAccountNumber" TEXT,
ADD COLUMN     "virtualBankName" TEXT DEFAULT 'Zenith Bank / Odeda Treasury';

-- AlterTable
ALTER TABLE "services" DROP COLUMN "defaultFee",
DROP COLUMN "feeDescription",
DROP COLUMN "feeType",
DROP COLUMN "slug",
ADD COLUMN     "certificateType" "CertificateType" NOT NULL,
ADD COLUMN     "code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "agentId",
DROP COLUMN "assignedWardId",
DROP COLUMN "commissionRate",
DROP COLUMN "contractorId",
DROP COLUMN "createdById",
DROP COLUMN "deletedAt",
DROP COLUMN "idType",
DROP COLUMN "isWalkIn",
DROP COLUMN "lastLoginAt",
DROP COLUMN "notifyByEmail",
DROP COLUMN "notifyByInApp",
DROP COLUMN "notifyBySms",
DROP COLUMN "passwordResetRequired",
DROP COLUMN "suspendedAt",
DROP COLUMN "suspendedById",
DROP COLUMN "suspensionReason",
DROP COLUMN "walkInRegisteredById";

-- AlterTable
ALTER TABLE "wards" DROP COLUMN "deletedAt";

-- DropTable
DROP TABLE "_ContractorWards";

-- DropTable
DROP TABLE "application_approvals";

-- DropTable
DROP TABLE "field_inspections";

-- DropTable
DROP TABLE "service_applications";

-- DropTable
DROP TABLE "service_fee_schedules";

-- DropTable
DROP TABLE "treasury_assessments";

-- CreateTable
CREATE TABLE "service_fee_configs" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_fee_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'submitted',
    "serviceId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "createdById" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "ward" TEXT,
    "nin" TEXT,
    "cacNumber" TEXT,
    "feeAmount" DECIMAL(12,2) NOT NULL,
    "formData" JSONB NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_fee_configs_serviceId_key" ON "service_fee_configs"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "applications_applicationNumber_key" ON "applications"("applicationNumber");

-- CreateIndex
CREATE INDEX "applications_serviceId_idx" ON "applications"("serviceId");

-- CreateIndex
CREATE INDEX "applications_applicantId_idx" ON "applications"("applicantId");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_applicationId_key" ON "invoices"("applicationId");

-- CreateIndex
CREATE INDEX "invoices_paymentStatus_idx" ON "invoices"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "services_code_key" ON "services"("code");

-- AddForeignKey
ALTER TABLE "service_fee_configs" ADD CONSTRAINT "service_fee_configs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_fee_configs" ADD CONSTRAINT "service_fee_configs_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
