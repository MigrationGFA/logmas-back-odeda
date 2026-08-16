-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'lga_admin', 'chairman', 'treasurer', 'auditor', 'ward_councillor', 'contractor', 'agent', 'field_officer', 'business_owner', 'citizen');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('CERTIFICATE', 'RATES_AND_LEVIES', 'LICENCES_AND_PERMITS', 'URBAN_DEVELOPMENT');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('fixed', 'variable', 'tiered');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'submitted', 'under_review', 'inspection_required', 'inspection_completed', 'awaiting_information', 'awaiting_assessment', 'invoice_generated', 'awaiting_payment', 'payment_confirmed', 'pending_approval', 'approved', 'returned_for_correction', 'rejected', 'certificate_generated', 'completed', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('online_gateway', 'bank_transfer', 'virtual_account', 'pos', 'cash');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'confirmed', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'assigned', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('sms', 'email', 'whatsapp', 'in_app');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('login', 'logout', 'login_failed', 'declaration_accepted', 'application_created', 'application_submitted', 'field_inspection_logged', 'treasury_assessed', 'invoice_created', 'invoice_adjusted', 'invoice_cancelled', 'payment_confirmed', 'payment_reversed', 'receipt_generated', 'approval_granted', 'correction_requested', 'application_rejected', 'certificate_issued', 'certificate_revoked', 'user_created', 'user_updated', 'user_suspended');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('minor', 'moderate', 'critical');

-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('open', 'under_review', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'citizen',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "avatarUrl" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "address" TEXT,
    "town" TEXT,
    "occupation" TEXT,
    "idType" TEXT,
    "nin" TEXT,
    "cacNumber" TEXT,
    "businessName" TEXT,
    "businessType" TEXT,
    "taxIdNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "suspendedAt" TIMESTAMP(3),
    "suspendedById" TEXT,
    "suspensionReason" TEXT,
    "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyBySms" BOOLEAN NOT NULL DEFAULT true,
    "notifyByInApp" BOOLEAN NOT NULL DEFAULT true,
    "wardId" TEXT,
    "assignedWardId" TEXT,
    "contractorId" TEXT,
    "commissionRate" DOUBLE PRECISION DEFAULT 0.0,
    "agentId" TEXT,
    "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
    "walkInRegisteredById" TEXT,
    "createdById" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "revenueHead" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT[],
    "estimatedDays" INTEGER NOT NULL DEFAULT 3,
    "defaultFee" DECIMAL(12,2) NOT NULL,
    "feeType" "FeeType" NOT NULL DEFAULT 'fixed',
    "feeDescription" TEXT NOT NULL,
    "supportsRenewal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_fee_schedules" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feeType" "FeeType" NOT NULL DEFAULT 'fixed',
    "baseFee" DECIMAL(12,2) NOT NULL,
    "revenueHead" TEXT NOT NULL,
    "calculationRule" TEXT,
    "latePenaltyRate" DECIMAL(5,2) DEFAULT 10,
    "billingCycle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_fee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_applications" (
    "id" TEXT NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "serviceId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "wardId" TEXT,
    "nin" TEXT,
    "cacNumber" TEXT,
    "formData" JSONB NOT NULL,
    "declarationAcceptedAt" TIMESTAMP(3),
    "declarationIpAddress" TEXT,
    "declarationVersion" TEXT DEFAULT 'v1.0-odeda-2026',
    "invoiceId" TEXT,
    "rejectionReason" TEXT,
    "correctionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_inspections" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "recommendedCategory" TEXT,
    "recommendedFee" DECIMAL(12,2),
    "sitePhotos" TEXT[],
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_assessments" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "assessedById" TEXT NOT NULL,
    "approvedFee" DECIMAL(12,2) NOT NULL,
    "revenueHead" TEXT NOT NULL,
    "treasuryNotes" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_approvals" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "revenueHead" TEXT NOT NULL,
    "description" TEXT,
    "amountPayable" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(12,2) NOT NULL,
    "penaltyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "virtualAccountNo" TEXT,
    "virtualAccountBank" TEXT DEFAULT 'Zenith Bank / Odeda Treasury',
    "virtualAccountRef" TEXT,
    "qrToken" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedOfficerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'virtual_account',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "reference" TEXT NOT NULL,
    "gatewayRef" TEXT,
    "narration" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
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
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "applicationId" TEXT NOT NULL,
    "issuedById" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
    "raisedById" TEXT NOT NULL,
    "wardId" TEXT,
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
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
    "userId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "smsStatus" "NotificationStatus",
    "smsSentAt" TIMESTAMP(3),
    "smsFailReason" TEXT,
    "emailStatus" "NotificationStatus",
    "emailSentAt" TIMESTAMP(3),
    "emailFailReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "businessName" TEXT,
    "address" TEXT,
    "wardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ViolationSeverity" NOT NULL DEFAULT 'minor',
    "status" "ViolationStatus" NOT NULL DEFAULT 'open',
    "businessId" TEXT,
    "loggedById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ContractorWards" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContractorWards_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_nin_key" ON "users"("nin");

-- CreateIndex
CREATE UNIQUE INDEX "users_cacNumber_key" ON "users"("cacNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_assignedWardId_key" ON "users"("assignedWardId");

-- CreateIndex
CREATE UNIQUE INDEX "wards_name_key" ON "wards"("name");

-- CreateIndex
CREATE UNIQUE INDEX "wards_code_key" ON "wards"("code");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "service_applications_applicationNo_key" ON "service_applications"("applicationNo");

-- CreateIndex
CREATE UNIQUE INDEX "service_applications_invoiceId_key" ON "service_applications"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "field_inspections_applicationId_key" ON "field_inspections"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_assessments_applicationId_key" ON "treasury_assessments"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "application_approvals_applicationId_key" ON "application_approvals"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_virtualAccountRef_key" ON "invoices"("virtualAccountRef");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_qrToken_key" ON "invoices"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_verificationCode_key" ON "invoices"("verificationCode");

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
CREATE UNIQUE INDEX "certificates_certificateNumber_key" ON "certificates"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verificationCode_key" ON "certificates"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_qrToken_key" ON "certificates"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_applicationId_key" ON "certificates"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_ticketNumber_key" ON "complaints"("ticketNumber");

-- CreateIndex
CREATE INDEX "_ContractorWards_B_index" ON "_ContractorWards"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assignedWardId_fkey" FOREIGN KEY ("assignedWardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_walkInRegisteredById_fkey" FOREIGN KEY ("walkInRegisteredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_fee_schedules" ADD CONSTRAINT "service_fee_schedules_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_applications" ADD CONSTRAINT "service_applications_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_applications" ADD CONSTRAINT "service_applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_applications" ADD CONSTRAINT "service_applications_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_applications" ADD CONSTRAINT "service_applications_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_inspections" ADD CONSTRAINT "field_inspections_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "service_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_inspections" ADD CONSTRAINT "field_inspections_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_assessments" ADD CONSTRAINT "treasury_assessments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "service_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_assessments" ADD CONSTRAINT "treasury_assessments_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_approvals" ADD CONSTRAINT "application_approvals_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "service_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_approvals" ADD CONSTRAINT "application_approvals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "service_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_responses" ADD CONSTRAINT "complaint_responses_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContractorWards" ADD CONSTRAINT "_ContractorWards_A_fkey" FOREIGN KEY ("A") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContractorWards" ADD CONSTRAINT "_ContractorWards_B_fkey" FOREIGN KEY ("B") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
