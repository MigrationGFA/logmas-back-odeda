-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "matchStatus" TEXT,
ADD COLUMN     "payerAccount" TEXT,
ADD COLUMN     "payerBank" TEXT,
ADD COLUMN     "payerName" TEXT,
ADD COLUMN     "rawPayload" JSONB,
ADD COLUMN     "serviceCode" TEXT,
ADD COLUMN     "settledAt" TIMESTAMP(3),
ALTER COLUMN "invoiceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "payments_matchStatus_idx" ON "payments"("matchStatus");

-- CreateIndex
CREATE INDEX "payments_serviceCode_status_idx" ON "payments"("serviceCode", "status");
