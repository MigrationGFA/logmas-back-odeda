// src/payments/payment.service.ts
//
// Shared "confirm a payment against an invoice" logic — extracted from your existing
// recordInvoicePayment/simulatePayment transaction blocks so it's reusable and idempotent
// across: field officer manual entry, Paystack webhook, and Paystack verify-on-refresh.
//
// TODO: fix these import paths to match your actual project structure
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import {
  generateReference,
  generateReceiptNumber,
  generateVerificationCode,
  generateQrToken,
} from "../../utils/generators"; // TODO: match your actual utils path

interface ConfirmPaymentParams {
  invoiceId: string; // Invoice.id (not invoiceNumber — resolve that before calling this)
  amount: number;
  method: PaymentMethod;
  reference?: string;
  gatewayRef?: string;
  narration?: string;
  paidById?: string | null;
  confirmedById?: string | null; // officer who confirmed cash/POS, null for gateway/system
}

interface ConfirmPaymentResult {
  alreadyProcessed: boolean;
  payment: any;
  invoice: any;
  receipt: any | null;
  isFullPayment: boolean;
}

/**
 * Confirms a payment against an invoice: creates the Payment row, updates the invoice's
 * amountPaid/balanceDue/status, and generates a Receipt on full payment.
 *
 * IDEMPOTENT: if a Payment with this reference already exists and is already `confirmed`,
 * this returns the existing state instead of double-crediting the invoice. This matters
 * because Paystack webhooks can fire more than once for the same event, and your
 * verify-on-refresh call can also race with the webhook — both may try to confirm the
 * same transaction.
 */
export async function confirmPayment({
  invoiceId,
  amount,
  method,
  reference,
  gatewayRef,
  narration,
  paidById,
  confirmedById,
}: ConfirmPaymentParams): Promise<ConfirmPaymentResult> {
  const finalReference = reference || generateReference("PAY");

  // Idempotency guard
  const existing = await prisma.payment.findUnique({ where: { reference: finalReference } });
  if (existing && existing.status === "confirmed") {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    const receipt = await prisma.receipt.findUnique({ where: { invoiceId } });
    return { alreadyProcessed: true, payment: existing, invoice, receipt, isFullPayment: invoice?.status === "paid" };
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  const balanceDue = Number(invoice.balanceDue);
  const isFullPayment = amount >= balanceDue;
  const newAmountPaid = Number(invoice.amountPaid) + amount;
  const newBalanceDue = Math.max(balanceDue - amount, 0);

  const result = await prisma.$transaction(async (tx) => {
    const payment = existing
      ? await tx.payment.update({
          where: { id: existing.id },
          data: {
            status: "confirmed",
            gatewayRef,
            confirmedAt: new Date(),
            confirmedById,
          },
        })
      : await tx.payment.create({
          data: {
            invoice: { connect: { id: invoiceId } },
            amount,
            method,
            status: "confirmed",
            reference: finalReference,
            gatewayRef,
            narration,
            confirmedAt: new Date(),
            confirmedById,
            paidBy: paidById ? { connect: { id: paidById } } : undefined,
          },
        });

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        status: isFullPayment ? "paid" : "partially_paid",
        paidAt: isFullPayment ? new Date() : null,
      },
    });

    let receipt = null;
    if (isFullPayment) {
      // Guard against duplicate receipt creation (Invoice.receipt is a unique 1:1)
      const existingReceipt = await tx.receipt.findUnique({ where: { invoiceId } });
      receipt =
        existingReceipt ??
        (await tx.receipt.create({
          data: {
            receiptNumber: generateReceiptNumber("RCP"),
            verificationCode: generateVerificationCode(),
            qrToken: generateQrToken(),
            amountPaid: newAmountPaid,
            invoice: { connect: { id: invoiceId } },
            issuedBy: { connect: { id: confirmedById ?? paidById ?? invoice.createdById } },
          },
        }));

      // Advance whatever this invoice is actually paying for. An Invoice can be linked
      // to at most one of these (schema enforces it via unique invoiceId on each side).
      const linkedPermit = await tx.permit.findUnique({ where: { invoiceId } });
      if (linkedPermit && linkedPermit.status !== "issued") {
        await tx.permit.update({
          where: { id: linkedPermit.id },
          data: { status: "issued" },
        });
      }

      const linkedApplication = await tx.stateOfOriginApplication.findUnique({ where: { invoiceId } });
      if (linkedApplication && linkedApplication.status !== "certificate_issued") {
        await tx.stateOfOriginApplication.update({
          where: { id: linkedApplication.id },
          data: { status: "paid" },
        });
      }
    }

    return { payment, invoice: updatedInvoice, receipt };
  });

  return { alreadyProcessed: false, ...result, isFullPayment };
}