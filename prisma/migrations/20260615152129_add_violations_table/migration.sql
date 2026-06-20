-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('minor', 'moderate', 'critical');

-- CreateEnum
CREATE TYPE "ViolationStatus" AS ENUM ('open', 'under_review', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "businessName" TEXT,
    "address" TEXT,
    "wardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ViolationSeverity" NOT NULL DEFAULT 'minor',
    "status" "ViolationStatus" NOT NULL DEFAULT 'open',
    "loggedById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
