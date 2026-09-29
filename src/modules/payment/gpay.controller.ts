import { Request, Response, NextFunction } from "express";

import type { PaymentIntent } from "@prisma/client";
import { completeNewApplicationAfterPayment, confirmPayment } from "./payment.service";
import { prisma } from "../../utils/prisma";
import { sendError, sendSuccess } from "../../utils/response";
import { generateReference } from "../../utils/generators";
import {
  initiateCheckout,
  pickCheckoutUrl,
  sameAmount,
  verifyTransaction,
  verifyWebhookSignature,
  isWebhookPaymentEvent,
  isWebhookPaid,
  type GpayWebhookPayload,
} from "./gpay.service";

// ─────────────────────────────────────────────────────────────
// GPay (Mastercard MPGS) controllers
//
// Two flows, mirroring the existing Paystack endpoints 1:1:
//   * initializeGpayInvoicePayment — an existing invoice paid by a logged-in user
//   * initializeGpayPublicPayment  — public "apply + pay first" flow
//
// Both create a PaymentIntent row BEFORE redirecting the payer, because GPay
// echoes no metadata back. verifyGpayPayment / gpayWebhook then read that row
// to know what the money was for.
// ─────────────────────────────────────────────────────────────

/** Placeholder used only when a user has no phone on file (User.phone is nullable). */
const PHONE_PLACEHOLDER = "08000000000";

function fullNameOf(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  if (name) return name;
  return (user.email ?? "").split("@")[0] || "Odeda LGA Taxpayer";
}

function phoneOf(phone: string | null | undefined, context: string): string {
  const value = phone?.trim();
  if (value) return value;
  console.warn(
    `[gpay.controller] no phone on file for ${context} — sending placeholder to GPay.`,
  );
  return PHONE_PLACEHOLDER;
}

/** Persists the raw gateway envelope on the intent so outcomes stay auditable. */
async function recordLastResponse(intentId: string, raw: any, status?: string) {
  try {
    await prisma.paymentIntent.update({
      where: { id: intentId },
      data: {
        lastResponse: raw ?? undefined,
        ...(status ? { status: status as any } : {}),
      },
    });
  } catch (err) {
    console.error("[gpay.controller] failed to record gateway response:", err);
  }
}

// ── Invoice flow: POST /api/v1/payments/gpay/initialize/:invoiceNumber ──

export const initializeGpayInvoicePayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { invoiceNumber } = req.params;
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: String(invoiceNumber) },
      include: { service: { select: { name: true } } },
    });

    if (!invoice) {
      return sendError(res, "Invoice not found", "NOT_FOUND", null, 404);
    }

    if (["paid", "cancelled"].includes(invoice.paymentStatus)) {
      return sendError(
        res,
        "Invoice is already paid or cancelled",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, phone: true },
    });

    // GPay takes Naira decimals — NOT kobo. No *100 here.
    const amount = Number(invoice.amount);
    const reference = generateReference("PAY");
    const customerName = fullNameOf(user ?? { email: userEmail });
    const customerPhone = phoneOf(user?.phone, `user ${userId}`);

    const intent = await prisma.paymentIntent.create({
      data: {
        reference,
        provider: "gpay",
        flow: "invoice_online",
        amount,
        currency: "NGN",
        status: "pending",
        invoiceId: invoice.id,
        payload: {
          flow: "invoice_online",
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          userId,
          fullName: customerName,
          email: userEmail,
          phone: customerPhone,
        },
      },
    });

    const gatewayResult = await initiateCheckout({
      amount,
      currency: "NGN",
      merchantTransactionRef: reference,
      customerName,
      customerEmail: userEmail,
      customerPhone,
      description: `${invoice.service?.name ?? "Odeda LGA Payment"} — ${invoice.invoiceNumber}`,
    });

    if (!gatewayResult.success || !gatewayResult.data) {
      await recordLastResponse(intent.id, gatewayResult.raw ?? null, "failed");

      return sendError(
        res,
        gatewayResult.error ?? "Failed to initialize payment",
        "PAYMENT_INITIALIZATION_FAILED",
        null,
        400,
      );
    }

    const data = gatewayResult.data;
    const checkoutUrl = pickCheckoutUrl(data);

    if (!checkoutUrl) {
      await recordLastResponse(intent.id, gatewayResult.raw ?? null, "failed");
      return sendError(
        res,
        "GPay did not return a checkout URL",
        "PAYMENT_INITIALIZATION_FAILED",
        null,
        502,
      );
    }

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        gpayReference: data.transactionRef,
        mastercardSessionId: data.mastercardSessionId,
        checkoutUrl,
        initiateResponse: gatewayResult.raw ?? undefined,
      },
    });

    // Keep the same pending Payment row the Paystack flow created, so confirmPayment
    // can find this attempt by reference when the webhook/verify lands.
    await prisma.payment.create({
      data: {
        invoice: { connect: { id: invoice.id } },
        amount,
        method: "online_gateway",
        status: "pending",
        reference,
        paidBy: { connect: { id: userId } },
      },
    });

    return sendSuccess(res, {
      paymentUrl: checkoutUrl,
      reference,
      amount,
      invoiceNumber: invoice.invoiceNumber,
      gateway: "gpay",
      message: "Redirect user to paymentUrl to complete payment",
    });
  } catch (err) {
    next(err);
  }
};

// ── Public flow: POST /api/v1/payments/gpay/public/initialize ──

interface GpayPublicPaymentBody {
  serviceId: string;
  fullName: string;
  email: string;
  phone: string;
}

export const initializeGpayPublicPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { serviceId, fullName, email, phone } =
      req.body as GpayPublicPaymentBody;

    if (!serviceId || !fullName || !email || !phone) {
      return sendError(
        res,
        "Service ID, full name, email and phone number are required",
        "VALIDATION_ERROR",
        null,
        400,
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();

    // 1. Service + current fee
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { feeConfig: true },
    });

    if (!service) {
      return sendError(res, "Service not found", "NOT_FOUND", null, 404);
    }

    if (!service.isActive) {
      return sendError(
        res,
        "Service is not active",
        "SERVICE_INACTIVE",
        null,
        400,
      );
    }

    if (!service.feeConfig || service.feeConfig.status !== "ACTIVE") {
      return sendError(
        res,
        "Service fee is not configured",
        "SERVICE_FEE_NOT_CONFIGURED",
        null,
        400,
      );
    }

    // GPay takes Naira decimals — NOT kobo.
    const amount = Number(service.feeConfig.amount);
    const reference = generateReference("PAY");

    // If this person already has an account we remember it, but nothing is
    // created here — the user/application/invoice are only created once the
    // payment is confirmed (same behaviour as the Paystack flow).
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    });

    // Everything needed to finish the application later. GPay echoes no
    // metadata, so this is the only copy of the context.
    const payload = {
      flow: "new_application",
      serviceId: service.id,
      serviceCode: service.code,
      serviceName: service.name,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      userId: existingUser?.id ?? null,
    };

    const intent = await prisma.paymentIntent.create({
      data: {
        reference,
        provider: "gpay",
        flow: "new_application",
        amount,
        currency: "NGN",
        status: "pending",
        payload,
      },
    });

    const gatewayResult = await initiateCheckout({
      amount,
      currency: "NGN",
      merchantTransactionRef: reference,
      customerName: cleanName,
      customerEmail: cleanEmail,
      customerPhone: cleanPhone,
      description: `${service.name} — Odeda LGA`,
    });

    if (!gatewayResult.success || !gatewayResult.data) {
      await recordLastResponse(intent.id, gatewayResult.raw ?? null, "failed");

      return sendError(
        res,
        gatewayResult.error ?? "Failed to initialize payment",
        "PAYMENT_INITIALIZATION_FAILED",
        null,
        400,
      );
    }

    const data = gatewayResult.data;
    const checkoutUrl = pickCheckoutUrl(data);

    if (!checkoutUrl) {
      await recordLastResponse(intent.id, gatewayResult.raw ?? null, "failed");
      return sendError(
        res,
        "GPay did not return a checkout URL",
        "PAYMENT_INITIALIZATION_FAILED",
        null,
        502,
      );
    }

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        gpayReference: data.transactionRef,
        mastercardSessionId: data.mastercardSessionId,
        checkoutUrl,
        initiateResponse: gatewayResult.raw ?? undefined,
      },
    });

    return sendSuccess(res, {
      paymentUrl: checkoutUrl,
      reference,
      amount,
      serviceId: service.id,
      flow: "new_application",
      gateway: "gpay",
    });
  } catch (err) {
    next(err);
  }
};

// ── Shared: turn a paid gateway response into a confirmed payment ──

interface SettleParams {
  reference: string;
  amount: number;
  gpayReference: string | null;
  gatewayReference: string | null;
  mastercardSessionId: string | null;
  raw: any;
  source: "verify" | "webhook";
}

type SettleOutcome =
  | { status: "confirmed"; result: any }
  | { status: "already_confirmed" }
  | { status: "amount_mismatch" }
  | { status: "error"; error: string };

async function settleIntent(
  intent: PaymentIntent,
  params: SettleParams,
): Promise<SettleOutcome> {
  if (intent.status === "confirmed") {
    return { status: "already_confirmed" };
  }

  // Never confirm an amount that doesn't match what we asked for. This is the
  // guard the old Paystack flow was missing.
  if (!sameAmount(params.amount, intent.amount)) {
    console.error(
      `[gpay.${params.source}] amount mismatch for ${intent.reference}: ` +
        `gateway=${params.amount} expected=${intent.amount} — refusing to confirm`,
    );
    await recordLastResponse(intent.id, params.raw);
    return { status: "amount_mismatch" };
  }

  const payload = (intent.payload ?? {}) as any;
  const gatewayRef = params.gpayReference ?? intent.gpayReference ?? undefined;

  let result: any;

  if (intent.flow === "new_application") {
    // Rebuild the metadata object the completion service expects. GPay gives us
    // nothing back, so this comes entirely from the stored intent payload.
    result = await completeNewApplicationAfterPayment({
      paymentReference: intent.reference,
      amount: params.amount,
      gatewayRef,
      metadata: {
        flow: "new_application",
        serviceId: payload.serviceId,
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        userId: payload.userId ?? null,
      },
    });
  } else {
    if (!intent.invoiceId) {
      console.error(
        `[gpay.${params.source}] intent ${intent.reference} has no linked invoice`,
      );
      return { status: "error", error: "Payment intent has no linked invoice" };
    }

    result = await confirmPayment({
      invoiceId: intent.invoiceId,
      amount: params.amount,
      method: "online_gateway",
      reference: intent.reference,
      gatewayRef,
      paidById: payload.userId ?? null,
      confirmedById: null,
    });
  }

  const now = new Date();

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: "confirmed",
      // We stamp confirmation time ourselves: GPay's timestamps ("2026-09-25
      // 15:18:20") carry no timezone, so the raw value stays in lastResponse
      // and is never used to date a receipt.
      paidAt: now,
      completedAt: now,
      gatewayReference: params.gatewayReference ?? intent.gatewayReference,
      mastercardSessionId:
        params.mastercardSessionId ?? intent.mastercardSessionId,
      gpayReference: gatewayRef,
      lastResponse: params.raw ?? undefined,
    },
  });

  return { status: "confirmed", result };
}

// ── Verify: GET /api/v1/payments/gpay/verify/:reference ──

export const verifyGpayPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const reference = req.params.reference as string;

    const intent = await prisma.paymentIntent.findUnique({
      where: { reference },
    });

    if (!intent) {
      return sendError(
        res,
        "Payment reference not found",
        "NOT_FOUND",
        null,
        404,
      );
    }

    if (intent.status === "confirmed") {
      return sendSuccess(res, {
        status: "confirmed",
        flow: intent.flow,
        reference,
        alreadyConfirmed: true,
      });
    }

    const verifyResult = await verifyTransaction(reference);

    if (!verifyResult.success || !verifyResult.data) {
      return sendError(
        res,
        verifyResult.error ?? "Failed to verify with GPay",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const data = verifyResult.data;
    await recordLastResponse(intent.id, verifyResult.raw ?? null);

    if (!data.isPaid) {
      if (data.status === "failed") {
        await prisma.paymentIntent.update({
          where: { id: intent.id },
          data: { status: "failed" },
        });
      }

      return sendSuccess(res, {
        status: data.status,
        reference,
        rawStatus: data.rawStatus,
        mpgsResult: data.mpgsResult,
      });
    }

    const outcome = await settleIntent(intent, {
      reference,
      amount: Number(data.amount),
      gpayReference: data.gpayReference,
      gatewayReference: data.gatewayReference,
      mastercardSessionId: data.mastercardSessionId,
      raw: verifyResult.raw ?? null,
      source: "verify",
    });

    if (outcome.status === "amount_mismatch") {
      return sendError(
        res,
        "Paid amount does not match the expected amount",
        "AMOUNT_MISMATCH",
        null,
        409,
      );
    }

    if (outcome.status === "error") {
      return sendError(
        res,
        outcome.error,
        "PAYMENT_CONFIRMATION_FAILED",
        null,
        500,
      );
    }

    return sendSuccess(res, {
      status: "confirmed",
      flow: intent.flow,
      ...(outcome.status === "confirmed" ? outcome.result : {}),
    });
  } catch (err) {
    next(err);
  }
};

// ── Webhook: POST /api/v1/payments/gpay/webhook ──

export const gpayWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["x-gpay-signature"] as string | undefined;
  const rawBody = req.body as Buffer;

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[gpay.webhook] rejected — invalid signature");
    return res.status(401).json({
      success: false,
      message: "Invalid webhook signature",
    });
  }

  // Acknowledge GPay immediately; processing continues after the response.
  // Signature verification is what proves the call really came from GPay.
  res.status(200).json({ received: true });

  try {
    const payload = JSON.parse(rawBody.toString("utf8")) as GpayWebhookPayload;

    if (!isWebhookPaymentEvent(payload)) {
      console.log(`[gpay.webhook] ignoring event: ${payload?.event}`);
      return;
    }

    const reference = payload.data?.merchant_transaction_ref;

    if (!reference) {
      console.error("[gpay.webhook] payload has no merchant_transaction_ref");
      return;
    }

    const intent = await prisma.paymentIntent.findUnique({
      where: { reference },
    });

    if (!intent) {
      console.error(
        `[gpay.webhook] no PaymentIntent found for reference ${reference}`,
      );
      return;
    }

    if (intent.status === "confirmed") {
      console.log(
        `[gpay.webhook] ${reference} already confirmed — ignoring duplicate delivery`,
      );
      return;
    }

    if (!isWebhookPaid(payload)) {
      console.warn(
        `[gpay.webhook] ${reference} reported status "${payload.data?.status}" — leaving pending`,
      );
      await recordLastResponse(intent.id, payload);
      return;
    }

    const outcome = await settleIntent(intent, {
      reference,
      amount: Number(payload.data?.amount),
      gpayReference: payload.data?.gpay_reference ?? null,
      gatewayReference: payload.data?.gateway_reference ?? null,
      mastercardSessionId: payload.data?.mastercard_session_id ?? null,
      raw: payload,
      source: "webhook",
    });

    console.log(`[gpay.webhook] ${reference} → ${outcome.status}`);
  } catch (err) {
    console.error("[gpay.webhook] processing error:", err);
  }
};




