// src/modules/payment/gpay.service.ts
//
// Core GPay (Mastercard MPGS) wrapper — schema-independent. Handles talking to
// GPay's API only. Wiring this to Invoice / Payment / PaymentIntent rows happens
// in gpay.controller.ts.
//
// Merchant: Odeda LGA (merchant id 3 / merchant code "odedalga")
// Gateway base: https://gpay.gfa-tech.com/api/v1
//
// Notable differences from Paystack that this file has to absorb:
//   * amounts are decimal NGN, NOT kobo (no *100 anywhere)
//   * verify takes a query param, not a path param
//   * the webhook is HMAC-SHA256 with a dedicated webhook secret (not the API key)
//   * GPay echoes NO metadata, so callers must persist their own context
//     (see PaymentIntent in prisma/schema.prisma)

import crypto from "crypto";

const GPAY_BASE_URL = (
  process.env.GPAY_BASE_URL?.trim() || "https://gpay.gfa-tech.com/api/v1"
).replace(/\/+$/, "");

// Bearer token sent on every call. GPAY_AUTH_SECRET is the documented
// `authorization_secret`; we fall back to the merchant API key in case the two
// turn out to be the same value for this merchant.
const GPAY_AUTH_SECRET =
  process.env.GPAY_AUTH_SECRET?.trim() || process.env.GPAY_API_KEY?.trim();

// Separate secret used only to verify inbound webhook signatures.
const GPAY_WEBHOOK_SECRET =
  process.env.GPAY_WEBHOOK_SECRET?.trim() || undefined;

// GPay returns two checkout links: the raw Mastercard MPGS hosted page
// (`checkout_url`) and GPay's own wrapper page (`gpay_checkout_url`). We default
// to GPay's page because that is the one wired to honour the `return_url` we
// send. Flip GPAY_USE_DIRECT_CHECKOUT=true to use the MPGS link instead.
const USE_DIRECT_MPGS_CHECKOUT = process.env.GPAY_USE_DIRECT_CHECKOUT === "true";

const GPAY_TIMEOUT_MS = Number(process.env.GPAY_TIMEOUT_MS ?? 30_000);

if (!GPAY_AUTH_SECRET) {
  console.warn(
    "[gpay.service] GPAY_AUTH_SECRET / GPAY_API_KEY is not set — GPay calls will fail.",
  );
} else if (!process.env.GPAY_AUTH_SECRET?.trim()) {
  console.warn(
    "[gpay.service] GPAY_AUTH_SECRET is not set — falling back to GPAY_API_KEY. Note: " +
      "the merchant API key alone returned 401 on GPay's endpoints during testing, so set " +
      "GPAY_AUTH_SECRET to the bearer token GPay actually accepts.",
  );
}
if (!GPAY_WEBHOOK_SECRET) {
  console.warn(
    "[gpay.service] GPAY_WEBHOOK_SECRET is not set — webhook signature verification will always fail.",
  );
}

// ── URLs ──────────────────────────────────────────────────────

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Where the payer lands after finishing (or abandoning) the hosted page. */
export const gpayReturnUrl = `${trimSlash(
  process.env.GPAY_RETURN_URL ??
    process.env.FRONTEND_URL ??
    "http://localhost:3002",
)}/payment/result`;

/**
 * Where GPay should POST the payment notification. Must be publicly reachable
 * (use ngrok/a tunnel while developing locally).
 */
export const gpayWebhookUrl = (() => {
  const explicit = process.env.GPAY_WEBHOOK_URL;
  if (explicit) return explicit;

  const base = process.env.API_BASE_URL ?? process.env.BACKEND_URL;
  if (base) return `${trimSlash(base)}/api/v1/payments/gpay/webhook`;

  console.warn(
    "[gpay.service] GPAY_WEBHOOK_URL is not set — falling back to a localhost URL. GPay will not be able to reach this webhook; use the local simulator script.",
  );
  return "http://localhost:3004/api/v1/payments/gpay/webhook";
})();

// ── Status normalisation ──────────────────────────────────────

/**
 * GPay reports transaction state inconsistently across its own endpoints
 * (`"successful"` on the webhook, `"SUCCESS"` inside the raw MPGS
 * `order_details` block, `"pending"` on verify). Everything is funnelled into
 * three buckets before any decision is made. Unknown values are treated as
 * "pending" — an unrecognised string is never treated as a successful payment.
 */
export type NormalizedStatus = "successful" | "failed" | "pending";

const SUCCESS_STATES = new Set([
  "successful",
  "success",
  "captured",
  "approved",
  "completed",
  "paid",
  "settled",
]);

const FAILED_STATES = new Set([
  "failed",
  "failure",
  "declined",
  "decline",
  "cancelled",
  "canceled",
  "expired",
  "voided",
  "reversed",
  "error",
  "abandoned",
  "timeout",
]);

export function normalizeGatewayStatus(value: unknown): NormalizedStatus {
  if (value === null || value === undefined) return "pending";
  const v = String(value).trim().toLowerCase();
  if (!v) return "pending";
  if (SUCCESS_STATES.has(v)) return "successful";
  if (FAILED_STATES.has(v)) return "failed";
  return "pending";
}

/**
 * GPay amounts arrive as decimal strings ("100.00"). Compare rounded to the
 * smallest unit so float representation can never cause a mismatch.
 */
export function sameAmount(a: unknown, b: unknown): boolean {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.round(na * 100) === Math.round(nb * 100);
}

// ── Envelope helpers ──────────────────────────────────────────

/**
 * GPay replies with `{ status, response_code, message, data }` where
 * `response_code` is an ISO8583-style code ("00" = approved). Two different
 * fields are called "status": the top-level one describes the API call, while
 * `data.status` describes the transaction.
 */
export function isEnvelopeSuccess(json: any): boolean {
  if (!json || typeof json !== "object") return false;
  if (json.status !== "success") return false;
  if (json.response_code !== undefined && json.response_code !== null) {
    if (String(json.response_code) !== "00") return false;
  }
  return true;
}

function envelopeError(json: any, fallback: string): string {
  const message = json?.message ?? json?.error ?? fallback;
  const code =
    json?.response_code !== undefined && json?.response_code !== null
      ? ` (response_code: ${json.response_code})`
      : "";
  return `${message}${code}`;
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ── 1. Initiate checkout session ──────────────────────────────

export interface InitiateCheckoutParams {
  /** NGN, decimal. GPay expects Naira units — do NOT multiply by 100. */
  amount: number;
  currency?: string;
  /** Our own unique reference — sent as `merchant_transaction_ref`. */
  merchantTransactionRef: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description?: string;
  returnUrl?: string;
  webhookUrl?: string;
}

export interface InitiateCheckoutData {
  transactionRef: string | null;
  merchantTransactionRef: string | null;
  orderId: string | null;
  amount: string | null;
  currency: string | null;
  status: NormalizedStatus;
  rawStatus: string | null;
  gatewayName: string | null;
  checkoutUrl: string | null;
  gpayCheckoutUrl: string | null;
  mastercardSessionId: string | null;
  sessionVersion: string | null;
  successIndicator: string | null;
  createdAt: string | null;
  raw: any;
}

export interface GpayResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** Raw gateway envelope, kept for auditing/storage. */
  raw?: any;
}

export async function initiateCheckout(
  params: InitiateCheckoutParams,
): Promise<GpayResult<InitiateCheckoutData>> {
  try {
    const res = await fetch(`${GPAY_BASE_URL}/mastercard/initiate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPAY_AUTH_SECRET}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency ?? "NGN",
        merchant_transaction_ref: params.merchantTransactionRef,
        customer_name: params.customerName,
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone,
        description: params.description,
        return_url: params.returnUrl ?? gpayReturnUrl,
        webhook_url: params.webhookUrl ?? gpayWebhookUrl,
      }),
      signal: AbortSignal.timeout(GPAY_TIMEOUT_MS),
    });

    const json = await safeJson(res);

    if (!res.ok || !isEnvelopeSuccess(json)) {
      return {
        success: false,
        error: envelopeError(json, "Failed to initiate GPay checkout"),
        raw: json,
      };
    }

    const d = json?.data ?? {};

    return {
      success: true,
      raw: json,
      data: {
        transactionRef: d.transaction_ref ?? null,
        merchantTransactionRef: d.merchant_transaction_ref ?? null,
        orderId: d.order_id ?? null,
        amount: d.amount ?? null,
        currency: d.currency ?? null,
        status: normalizeGatewayStatus(d.status),
        rawStatus: d.status ?? null,
        gatewayName: d.gateway_name ?? null,
        checkoutUrl: d.checkout_url ?? null,
        gpayCheckoutUrl: d.gpay_checkout_url ?? null,
        mastercardSessionId: d.mastercard_session_id ?? null,
        sessionVersion: d.session_version ?? null,
        successIndicator: d.success_indicator ?? null,
        createdAt: d.created_at ?? null,
        raw: d,
      },
    };
  } catch (err: any) {
    console.error("[gpay.service] initiateCheckout error:", err?.message ?? err);
    return {
      success: false,
      error: err?.message ?? "GPay initiate request failed",
    };
  }
}

/** Picks which of the two checkout links to hand to the payer. */
export function pickCheckoutUrl(
  data: Pick<InitiateCheckoutData, "checkoutUrl" | "gpayCheckoutUrl">,
): string | null {
  if (USE_DIRECT_MPGS_CHECKOUT) {
    return data.checkoutUrl ?? data.gpayCheckoutUrl ?? null;
  }
  return data.gpayCheckoutUrl ?? data.checkoutUrl ?? null;
}

// ── 2. Verify transaction ─────────────────────────────────────

export interface CustomerDetails {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface VerifyTransactionData {
  status: NormalizedStatus;
  rawStatus: string | null;
  /** True when either GPay's status or the raw MPGS verdict says paid. */
  isPaid: boolean;
  /** Raw MPGS `order_details.result`, e.g. "SUCCESS". */
  mpgsResult: string | null;
  amount: string | null;
  currency: string | null;
  gpayReference: string | null;
  orderId: string | null;
  merchantTransactionRef: string | null;
  gatewayName: string | null;
  gatewayReference: string | null;
  mastercardSessionId: string | null;
  customer: CustomerDetails | null;
  paidAtRaw: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  raw: any;
}

/**
 * A transaction counts as paid when EITHER signal says so.
 *
 * Observed on the sandbox: verify reported `status: "pending"` while the raw
 * MPGS block reported `order_details.result: "SUCCESS"` for the same
 * reference. Trusting `data.status` alone would leave genuinely paid invoices
 * unconfirmed (no receipt, citizen stuck, revenue unreconciled), so both are
 * accepted and the webhook / a later verify promotes the intent. This is the
 * single place to tighten once GPay confirms which field is authoritative.
 */
export function isPaidFromVerification(d: {
  rawStatus?: string | null;
  mpgsResult?: string | null;
}): boolean {
  return (
    normalizeGatewayStatus(d.rawStatus) === "successful" ||
    normalizeGatewayStatus(d.mpgsResult) === "successful"
  );
}

export async function verifyTransaction(
  merchantTransactionRef: string,
): Promise<GpayResult<VerifyTransactionData>> {
  try {
    const url = `${GPAY_BASE_URL}/mastercard/verify?merchant_transaction_ref=${encodeURIComponent(
      merchantTransactionRef,
    )}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GPAY_AUTH_SECRET}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(GPAY_TIMEOUT_MS),
    });

    const json = await safeJson(res);

    if (!res.ok || !isEnvelopeSuccess(json)) {
      return {
        success: false,
        error: envelopeError(json, "Failed to verify GPay transaction"),
        raw: json,
      };
    }

    const d = json?.data ?? {};
    const mpgsResult: string | null =
      d?.order_details?.result ?? d?.result ?? null;
    const rawStatus: string | null = d.status ?? null;

    return {
      success: true,
      raw: json,
      data: {
        status: normalizeGatewayStatus(rawStatus),
        rawStatus,
        isPaid: isPaidFromVerification({ rawStatus, mpgsResult }),
        mpgsResult,
        amount: d.amount ?? null,
        currency: d.currency ?? null,
        gpayReference: d.gpay_reference ?? d.transaction_ref ?? null,
        orderId: d.order_id ?? null,
        merchantTransactionRef: d.merchant_transaction_ref ?? null,
        gatewayName: d.gateway_name ?? null,
        gatewayReference: d.gateway_reference ?? null,
        mastercardSessionId: d.mastercard_session_id ?? null,
        customer: d.customer
          ? {
              name: d.customer.name ?? null,
              email: d.customer.email ?? null,
              phone: d.customer.phone ?? null,
            }
          : null,
        paidAtRaw: d.paid_at ?? null,
        createdAt: d.created_at ?? null,
        updatedAt: d.updated_at ?? null,
        raw: d,
      },
    };
  } catch (err: any) {
    console.error("[gpay.service] verifyTransaction error:", err?.message ?? err);
    return {
      success: false,
      error: err?.message ?? "GPay verify request failed",
    };
  }
}

// ── 3. Inbound webhook ────────────────────────────────────────

export interface GpayWebhookData {
  gpay_reference?: string;
  merchant_transaction_ref?: string;
  status?: string;
  amount?: string;
  currency?: string;
  gateway_name?: string;
  gateway_reference?: string | null;
  order_id?: string;
  mastercard_session_id?: string;
  paid_at?: string;
}

export interface GpayWebhookPayload {
  event?: string;
  data?: GpayWebhookData;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify that an inbound webhook really came from GPay.
 * GPay signs the raw request body with the webhook secret (HMAC-SHA256) and
 * sends it as `X-GPay-Signature`.
 *
 * The docs don't state whether the digest is hex or base64, so both are
 * accepted and the comparison is timing-safe. Tighten this to the confirmed
 * encoding once GPay confirms it.
 *
 * IMPORTANT: this needs the *raw* request body bytes, not parsed JSON — see the
 * express.raw() note in gpay.routes.ts.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!GPAY_WEBHOOK_SECRET) return false;
  if (!signatureHeader) return false;
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) return false;

  const provided = signatureHeader.trim().replace(/^sha256=/i, "");
  if (!provided) return false;

  // One HMAC instance per digest — digest() can only be called once per instance.
  const hex = crypto
    .createHmac("sha256", GPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  const base64 = crypto
    .createHmac("sha256", GPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("base64");

  return (
    timingSafeStringEqual(provided.toLowerCase(), hex) ||
    timingSafeStringEqual(provided, base64)
  );
}

/** True when this is a payment event we should act on. */
export function isWebhookPaymentEvent(payload: GpayWebhookPayload): boolean {
  return payload?.event === "charge.success";
}

/**
 * Whether a webhook payload represents a settled payment.
 *
 * `event === "charge.success"` is the strongest signal available and GPay only
 * dispatches it once the transaction is settled on MPGS. We refuse to treat it
 * as paid only when the payload explicitly reports a failed/declined state, so
 * we can never record revenue that does not exist. Amount is still re-checked
 * against our stored intent in the controller.
 */
export function isWebhookPaid(payload: GpayWebhookPayload): boolean {
  if (!isWebhookPaymentEvent(payload)) return false;
  return normalizeGatewayStatus(payload?.data?.status) !== "failed";
}




