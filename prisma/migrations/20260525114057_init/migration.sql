-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'lga_admin', 'chairman', 'treasurer', 'auditor', 'contractor', 'field_officer', 'citizen');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'assigned', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('draft', 'pending', 'issued', 'expired');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'citizen',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "councillor" TEXT NOT NULL,
    "councillorPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wardId" TEXT NOT NULL,
    "assignedToId" TEXT,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permits" (
    "id" TEXT NOT NULL,
    "permitNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "qrTokenToken" TEXT NOT NULL,
    "status" "PermitStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "permits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wards_name_key" ON "wards"("name");

-- CreateIndex
CREATE UNIQUE INDEX "wards_code_key" ON "wards"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permits_permitNumber_key" ON "permits"("permitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "permits_verificationCode_key" ON "permits"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "permits_qrTokenToken_key" ON "permits"("qrTokenToken");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
