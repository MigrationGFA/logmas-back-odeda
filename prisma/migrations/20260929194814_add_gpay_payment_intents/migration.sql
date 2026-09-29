-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('paystack', 'gpay');

-- CreateEnum
CREATE TYPE "PaymentIntentFlow" AS ENUM ('invoice_online', 'new_application');

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'gpay',
    "flow" "PaymentIntentFlow" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "invoiceId" TEXT,
    "payload" JSONB NOT NULL,
    "gpayReference" TEXT,
    "mastercardSessionId" TEXT,
    "gatewayReference" TEXT,
    "checkoutUrl" TEXT,
    "initiateResponse" JSONB,
    "lastResponse" JSONB,
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_reference_key" ON "payment_intents"("reference");

-- CreateIndex
CREATE INDEX "payment_intents_status_idx" ON "payment_intents"("status");

-- CreateIndex
CREATE INDEX "payment_intents_flow_idx" ON "payment_intents"("flow");

-- CreateIndex
CREATE INDEX "payment_intents_invoiceId_idx" ON "payment_intents"("invoiceId");

-- CreateIndex
CREATE INDEX "payment_intents_gpayReference_idx" ON "payment_intents"("gpayReference");

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
