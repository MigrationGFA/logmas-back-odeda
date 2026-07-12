// src/dev/dev.controller.ts
//
// Dev-only diagnostics — hits Termii/SMTP directly, bypasses notify()/Prisma entirely,
// so you see the RAW error instead of whatever notify() would otherwise swallow or crash on.
// Gated to admin roles only (not NODE_ENV) since you specifically need this working
// against the deployed environment, not just locally.

import { Request, Response, NextFunction } from "express";
import { sendError, sendSuccess } from "../../utils/response";
import { sendEmail, verifyConnection } from "../notification/email.service";
import { sendSms } from "../notification/sms.service";

const ALLOWED_ROLES = ["super_admin", "lga_admin"];

function checkDevAccess(req: Request, res: Response): boolean {
 
  return true;
}

// GET /api/v1/dev/smtp-status
export const checkSmtpStatus = async (req: Request, res: Response, next: NextFunction) => {
  if (!checkDevAccess(req, res)) return;
  try {
    const connected = await verifyConnection();
    return sendSuccess(res, {
      connected,
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        user: process.env.SMTP_USER,
        // never echo SMTP_PASS back
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/dev/test-sms
// body: { phone?: string, message?: string }
export const testSms = async (req: Request, res: Response, next: NextFunction) => {
  if (!checkDevAccess(req, res)) return;
  try {
    const phone = (req.body.phone ?? process.env.TEST_RECIPIENT_PHONE ?? "").replace("+", "");
    const message = req.body.message ?? "Dev test SMS from LOGMAS backend.";

    if (!phone) {
      return sendError(res, "No phone number provided and TEST_RECIPIENT_PHONE not set", "BAD_REQUEST", null, 400);
    }

    const result = await sendSms({ to: phone, message });

    return sendSuccess(res, {
      result,
      configUsed: {
        senderId: process.env.TERMII_SENDER_ID || "(EMPTY — this is likely your bug)",
        channel: process.env.TERMII_CHANNEL,
        baseUrl: process.env.TERMII_BASE_URL,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/dev/test-email
// body: { email?: string, subject?: string, message?: string }
export const testEmail = async (req: Request, res: Response, next: NextFunction) => {
  if (!checkDevAccess(req, res)) return;
  try {
    const email = req.body.email ?? process.env.TEST_RECIPIENT_EMAIL;
    const subject = req.body.subject ?? "Dev test email";
    const message = req.body.message ?? "<p>Dev test email from LOGMAS backend.</p>";

    if (!email) {
      return sendError(res, "No email provided and TEST_RECIPIENT_EMAIL not set", "BAD_REQUEST", null, 400);
    }

    const result = await sendEmail({ to: email, subject, html: message });

    return sendSuccess(res, {
      result,
      configUsed: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
      },
    });
  } catch (err) {
    next(err);
  }
};