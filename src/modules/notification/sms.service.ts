// src/notifications/sms.service.ts
// Wraps Termii's /api/sms/send endpoint.
// Docs: https://developers.termii.com/messaging-api

const TERMII_BASE_URL = process.env.TERMII_BASE_URL ?? "https://v3.api.termii.com";
const TERMII_API_KEY = process.env.TERMII_API_KEY;
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID; // ask your boss for the approved Sender ID

// "dnd" = transactional route (OTP, alerts, status updates — use this for almost everything here).
// "generic" = promotional/non-DND route.
type TermiiChannel = "dnd" | "generic" | "whatsapp";

interface SendSmsParams {
  to: string; // international format, e.g. "2348012345678"
  message: string;
  channel?: TermiiChannel;
  from?: string;
}

interface SendSmsResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

if (!TERMII_API_KEY) {
  console.warn("[sms.service] TERMII_API_KEY is not set — SMS sending will fail.");
}

export async function sendSms({
  to,
  message,
  channel = (process.env.TERMII_CHANNEL as TermiiChannel) ?? "dnd",
  from = TERMII_SENDER_ID,
}: SendSmsParams): Promise<SendSmsResult> {
  if (!to || !message) {
    return { success: false, error: "`to` and `message` are required" };
  }

  const payload = {
    api_key: TERMII_API_KEY,
    to,
    from,
    sms: message,
    type: "plain",
    channel,
  };

  try {
    const res = await fetch(`${TERMII_BASE_URL}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as Record<string, unknown>;

    // Termii returns { code: "ok", message: "Successfully Sent", ... } on success
    if (!res.ok || data.code !== "ok") {
      return { success: false, error: (data.message as string) ?? "Failed to send SMS", data };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("[sms.service] sendSms error:", err);
    return { success: false, error: err.message };
  }
}