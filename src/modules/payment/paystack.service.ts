// src/payments/paystack.service.ts
//
// Core Paystack wrapper — schema-independent. Handles talking to Paystack's API only.
// Wiring this to your Invoice/Payment models happens in payment.controller.ts.
//
// Docs: https://paystack.com/docs/api/transaction/

import crypto from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY) {
  console.warn("[paystack.service] PAYSTACK_SECRET_KEY is not set — Paystack calls will fail.");
}

interface InitializeTransactionParams {
  email: string;
  amountKobo: number; // Paystack expects the smallest currency unit — Naira * 100
  reference?: string; // optional — Paystack generates one if omitted, but you'll usually want to control it
  callbackUrl?: string; // where Paystack redirects the payer after payment (your frontend "payment result" page)
  metadata?: Record<string, unknown>; // stash your invoiceId/businessId/applicationId etc. here
}

interface InitializeTransactionResult {
  success: boolean;
  data?: {
    authorization_url: string; // the link you send the business owner / redirect the citizen to
    access_code: string;
    reference: string;
  };
  error?: string;
}

export async function initializeTransaction({
  email,
  amountKobo,
  reference,
  callbackUrl,
  metadata,
}: InitializeTransactionParams): Promise<InitializeTransactionResult> {
  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        reference,
        callback_url: callbackUrl,
        metadata,
      }),
    });

    const json = await res.json() as any;

    if (!res.ok || !json.status) {
      return { success: false, error: json.message ?? "Failed to initialize transaction" };
    }

    return {
      success: true,
      data: {
        authorization_url: json.data.authorization_url,
        access_code: json.data.access_code,
        reference: json.data.reference,
      },
    };
  } catch (err: any) {
    console.error("[paystack.service] initializeTransaction error:", err);
    return { success: false, error: err.message };
  }
}

interface VerifyTransactionResult {
  success: boolean;
  data?: {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amountKobo: number;
    paidAt: string | null;
    channel: string; // "card" | "bank" | "ussd" | etc.
    customerEmail: string;
    metadata: Record<string, unknown> | null;
  };
  error?: string;
}

export async function verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const json = await res.json() as any;

    if (!res.ok || !json.status) {
      return { success: false, error: json.message ?? "Failed to verify transaction" };
    }

    const tx = json.data;

    return {
      success: true,
      data: {
        status: tx.status,
        reference: tx.reference,
        amountKobo: tx.amount,
        paidAt: tx.paid_at,
        channel: tx.channel,
        customerEmail: tx.customer?.email,
        metadata: tx.metadata ?? null,
      },
    };
  } catch (err: any) {
    console.error("[paystack.service] verifyTransaction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Verify that an incoming webhook body actually came from Paystack.
 * Paystack signs the raw request body with your secret key (HMAC SHA512)
 * and sends it as the `x-paystack-signature` header.
 *
 * IMPORTANT: this needs the *raw* request body bytes, not the parsed JSON —
 * see the note in payment.controller.ts about express.raw() for the webhook route.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !PAYSTACK_SECRET_KEY) return false;

  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");

  return hash === signatureHeader;
}