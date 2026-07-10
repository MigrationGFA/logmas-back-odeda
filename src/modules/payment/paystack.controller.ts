// src/payments/paystack.controller.ts
//
// TODO: fix these import paths to match your actual project structure
import { Request, Response, NextFunction } from "express";

import { confirmPayment } from "./payment.service";
import { prisma } from "../../utils/prisma";
import { sendError, sendSuccess } from "../../utils/response";
import { generateReference } from "../../utils/generators";
import {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} from "./paystack.service";
import {
  interpolate,
  NotificationTemplates,
} from "../../config/notification.template";
import { sendSms } from "../notification/sms.service";
import { sendEmail } from "../notification/email.service";

// POST /api/v1/invoices/:id/pay-online
// Replaces the online-payment stub inside your existing recordInvoicePayment.
// `:id` is the invoiceNumber, matching your existing convention.
export const initializePaystackPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: String(id) },
    });
    if (!invoice)
      return sendError(res, "Invoice not found", "NOT_FOUND", null, 404);

    if (["paid", "cancelled"].includes(invoice.status)) {
      return sendError(
        res,
        "Invoice is already paid or cancelled",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const reference = generateReference("PAY");
    const amountKobo = Math.round(Number(invoice.totalAmount) * 100);

    const gatewayResult = await initializeTransaction({
      email: userEmail,
      amountKobo,
      reference,
      // TODO: set this to your frontend's "payment result" page, which reads ?reference=
      // from the URL and calls the verify endpoint below on load.
      callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        userId,
      },
    });

    if (!gatewayResult.success) {
      return sendError(
        res,
        gatewayResult.error ?? "Failed to initialize payment",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // Create a pending Payment row now so verify/webhook have something to match against by reference.
    await prisma.payment.create({
      data: {
        invoice: { connect: { id: invoice.id } },
        amount: Number(invoice.balanceDue),
        method: "online_gateway",
        status: "pending",
        reference,
        paidBy: { connect: { id: userId } },
      },
    });

    return sendSuccess(res, {
      paymentUrl: gatewayResult.data!.authorization_url,
      reference: gatewayResult.data!.reference,
      message: "Redirect user to paymentUrl to complete payment",
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/payments/verify/:reference
// This is what your frontend calls on refresh / on landing back from Paystack's redirect,
// so the citizen/business sees an updated status even if the webhook hasn't landed yet
// (useful right now especially, given your server's outbound network has been flaky).
export const verifyPaystackPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { reference } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { invoice: true },
    });
    if (!payment)
      return sendError(
        res,
        "Payment reference not found",
        "NOT_FOUND",
        null,
        404,
      );

    // Already confirmed — nothing to do, return current state.
    if (payment.status === "confirmed") {
      return sendSuccess(res, {
        status: "confirmed",
        payment,
        invoice: payment.invoice,
      });
    }

    const verifyResult = await verifyTransaction(reference);
    if (!verifyResult.success) {
      return sendError(
        res,
        verifyResult.error ?? "Failed to verify with Paystack",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    if (verifyResult.data!.status !== "success") {
      // Paystack says it's not paid yet — leave it pending, let the frontend keep polling/retrying.
      return sendSuccess(res, {
        status: verifyResult.data!.status,
        payment,
        invoice: payment.invoice,
      });
    }

    const confirmResult = await confirmPayment({
      invoiceId: payment.invoiceId,
      amount: verifyResult.data!.amountKobo / 100,
      method: "online_gateway",
      reference,
      gatewayRef: reference,
      paidById: payment.paidById,
      confirmedById: null, // system-confirmed, not an officer
    });

    return sendSuccess(res, {
      status: "confirmed",
      payment: confirmResult.payment,
      invoice: confirmResult.invoice,
      receipt: confirmResult.receipt,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/payments/webhook
// IMPORTANT: this route needs the RAW request body (not JSON-parsed) to verify Paystack's
// signature. In your app entry file, mount this route BEFORE your global express.json()
// middleware, or exclude this path from it — e.g.:
//
//   app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), paystackWebhook);
//   app.use(express.json()); // everything else
//
export const paystackWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["x-paystack-signature"] as string | undefined;
  const rawBody = req.body as Buffer; // requires express.raw() on this route, see note above

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid webhook signature" });
  }

  // Acknowledge immediately — Paystack retries if it doesn't get a fast 200.
  res.status(200).json({ received: true });

  try {
    const event = JSON.parse(rawBody.toString("utf8"));

    if (event.event === "charge.success") {
      const { reference, amount, metadata } = event.data;

      const payment = await prisma.payment.findUnique({ where: { reference } });
      if (!payment) {
        console.error(
          `[paystack.webhook] No payment found for reference ${reference}`,
        );
        return;
      }

      await confirmPayment({
        invoiceId: payment.invoiceId,
        amount: amount / 100,
        method: "online_gateway",
        reference,
        gatewayRef: reference,
        paidById: payment.paidById,
        confirmedById: null,
      });
    }
    // TODO: handle other event types if needed, e.g. "charge.failed" to mark Payment as failed
  } catch (err) {
    console.error("[paystack.webhook] processing error:", err);
  }
};

// POST /api/v1/invoices/:id/send-payment-link
// Field-officer-only. Sends the Paystack checkout link to the BUSINESS's phone/email
// directly — does not rely on req.user being the payer, since the officer is logged in,
// not the business owner.
export const sendPaymentLinkToBusiness = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params; // invoiceNumber, same convention as /pay and /pay-online
    const role = req.user!.role;

    if (!["field_officer", "lga_admin", "super_admin"].includes(role)) {
      return sendError(
        res,
        "Only field officers can send payment links",
        "FORBIDDEN",
        null,
        403,
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: String(id) },
      include: { business: true },
    });
    if (!invoice)
      return sendError(res, "Invoice not found", "NOT_FOUND", null, 404);
    if (!invoice.business) {
      return sendError(
        res,
        "This invoice has no linked business",
        "BAD_REQUEST",
        null,
        400,
      );
    }
    if (["paid", "cancelled"].includes(invoice.status)) {
      return sendError(
        res,
        "Invoice is already paid or cancelled",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const business = invoice.business;

    // TEST MODE: while we're validating the Paystack flow, send everything to a fixed
    // test contact instead of the real business's phone/email. Set NOTIFICATION_TEST_MODE=false
    // in .env once you're ready to send to real business contacts.
    const isTestMode = process.env.NOTIFICATION_TEST_MODE !== "false";
    const recipientEmail = isTestMode
      ? process.env.TEST_RECIPIENT_EMAIL
      : business.email;
    const recipientPhone = isTestMode
      ? process.env.TEST_RECIPIENT_PHONE
      : business.phone;

    if (!recipientEmail) {
      return sendError(
        res,
        isTestMode
          ? "TEST_RECIPIENT_EMAIL is not set in .env"
          : "This business has no email on file. Add one before sending a payment link.",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const reference = generateReference("PAY");
    const amountKobo = Math.round(Number(invoice.balanceDue) * 100);

    const gatewayResult = await initializeTransaction({
      email: recipientEmail,
      amountKobo,
      reference,
      callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        businessId: business.id,
      },
    });

    if (!gatewayResult.success) {
      return sendError(
        res,
        gatewayResult.error ?? "Failed to initialize payment",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // Pending Payment row so verify/webhook can match it later, paidBy left null —
    // there's no User guaranteed to exist for a true walk-in with no account.
    await prisma.payment.create({
      data: {
        invoice: { connect: { id: invoice.id } },
        amount: Number(invoice.balanceDue),
        method: "online_gateway",
        status: "pending",
        reference,
      },
    });

    const checkoutLink = gatewayResult.data!.authorization_url;
    const vars = {
      business_name: business.businessName,
      payment_amount: `₦${Number(invoice.balanceDue).toLocaleString()}`,
      checkout_link: checkoutLink,
      permit_type: invoice.description ?? "Trade Permit",
    };

    const template = NotificationTemplates.permit.invoiceGenerated;

    const [smsResult, emailResult] = await Promise.all([
      sendSms({
        to: recipientPhone!.replace("+", ""),
        message: interpolate(template.sms, vars),
      }),
      sendEmail({
        to: recipientEmail,
        subject: interpolate(template.emailSubject, vars),
        html: interpolate(template.emailHtml, vars),
      }),
    ]);

    return sendSuccess(res, {
      reference,
      checkoutLink,
      smsSent: smsResult.success,
      emailSent: emailResult.success,
    });
  } catch (err) {
    next(err);
  }
};
