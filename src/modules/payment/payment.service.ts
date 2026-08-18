// src/payments/payment.service.ts
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import {
  generateReference,
  generateReceiptNumber,
  generateVerificationCode,
  generateQrToken,
} from "../../utils/generators";

interface ConfirmPaymentParams {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  gatewayRef?: string;
  narration?: string;
  paidById?: string | null;
  confirmedById?: string | null;
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

  // ---------------------------------------------------------
  // 1. Idempotency check
  // ---------------------------------------------------------
  const existingPayment = await prisma.payment.findUnique({
    where: {
      reference: finalReference,
    },
  });

  if (existingPayment?.status === "confirmed") {
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
      },
    });

    const receipt = await prisma.receipt.findUnique({
      where: {
        invoiceId,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const confirmedPayments = await prisma.payment.aggregate({
      where: {
        invoiceId,
        status: "confirmed",
      },
      _sum: {
        amount: true,
      },
    });

    const amountPaid = Number(
      confirmedPayments._sum.amount || 0,
    );

    const balanceDue = Math.max(
      Number(invoice.amount) - amountPaid,
      0,
    );

    return {
      alreadyProcessed: true,
      payment: existingPayment,
      invoice,
      receipt,
      isFullPayment: balanceDue === 0,
    };
  }

  // ---------------------------------------------------------
  // 2. Get invoice
  // ---------------------------------------------------------
  const invoice = await prisma.invoice.findUnique({
    where: {
      id: invoiceId,
    },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  // ---------------------------------------------------------
  // 3. Calculate current payment position
  //    Invoice.amount is the authoritative invoice amount.
  //    Payment records determine how much has been paid.
  // ---------------------------------------------------------
  const confirmedPayments = await prisma.payment.aggregate({
    where: {
      invoiceId,
      status: "confirmed",
    },
    _sum: {
      amount: true,
    },
  });

  const amountAlreadyPaid = Number(
    confirmedPayments._sum.amount || 0,
  );

  const invoiceAmount = Number(invoice.amount);

  const remainingBeforePayment = Math.max(
    invoiceAmount - amountAlreadyPaid,
    0,
  );

  const newAmountPaid =
    amountAlreadyPaid + Number(amount);

  const newBalanceDue = Math.max(
    invoiceAmount - newAmountPaid,
    0,
  );

  const isFullPayment = newBalanceDue === 0;

  // ---------------------------------------------------------
  // 4. Create/confirm payment + receipt atomically
  // ---------------------------------------------------------
  const result = await prisma.$transaction(async (tx) => {
    const payment = existingPayment
      ? await tx.payment.update({
          where: {
            id: existingPayment.id,
          },
          data: {
            status: "confirmed",
            gatewayRef,
            confirmedAt: new Date(),
            confirmedById,
          },
        })
      : await tx.payment.create({
          data: {
            invoice: {
              connect: {
                id: invoiceId,
              },
            },
            amount,
            method,
            status: "confirmed",
            reference: finalReference,
            gatewayRef,
            narration,
            confirmedAt: new Date(),
            confirmedById,
            paidBy: paidById
              ? {
                  connect: {
                    id: paidById,
                  },
                }
              : undefined,
          },
        });

    // Remove stale pending payment attempts for this invoice.
    await tx.payment.deleteMany({
      where: {
        invoiceId,
        status: "pending",
        id: {
          not: payment.id,
        },
      },
    });

    // -------------------------------------------------------
    // 5. Create receipt only when invoice is fully paid
    // -------------------------------------------------------
    let receipt = null;

    if (isFullPayment) {
      const existingReceipt = await tx.receipt.findUnique({
        where: {
          invoiceId,
        },
      });

      if (existingReceipt) {
        receipt = existingReceipt;
      } else {
        const issuerId =
          confirmedById ||
          paidById ||
          invoice.createdById;

        receipt = await tx.receipt.create({
          data: {
            receiptNumber: generateReceiptNumber("RCP"),
            verificationCode: generateVerificationCode(),
            qrToken: generateQrToken(),
            amountPaid: newAmountPaid,
            invoice: {
              connect: {
                id: invoiceId,
              },
            },
            issuedBy: issuerId
              ? {
                  connect: {
                    id: issuerId,
                  },
                }
              : undefined,
          },
        });
      }
    }

    return {
      payment,
      invoice,
      receipt,
    };
  });

  return {
    alreadyProcessed: false,
    ...result,
    isFullPayment,
  };
}
