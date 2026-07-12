// src/notifications/notification.service.ts
//
// Orchestrates: resolve template -> interpolate -> send via sms/email -> log to Notification table.
//
// ASSUMPTIONS TO VERIFY AGAINST YOUR SCHEMA:
// - `NotificationChannel` enum has values matching "sms" | "email" (adjust CHANNEL below if not)
// - `NotificationStatus` enum has values matching "pending" | "sent" | "failed" (adjust STATUS below if not)
// - Prisma client is importable from "../lib/prisma" (a common convention) — change this import
//   to wherever your `prisma` singleton actually lives.

import { sendSms } from "./sms.service";
import { sendEmail } from "./email.service";
import { interpolate, NotificationTemplates, TemplateVars } from "../../config/notification.template";
import { prisma } from "../../utils/prisma";

// If your generated Prisma enums differ in casing, import and use those instead of these string unions.
type Channel = "sms" | "email";
type Status = "pending" | "sent" | "failed";

interface NotifyParams {
  userId: string;
  to: { phone?: string; email?: string };
  templateKey: string; // dot path, e.g. "soo.invoiceGenerated" or "account.passwordReset"
  vars: TemplateVars;
  channels: Channel[]; // which channels to actually send on for this call
}

interface ResolvedTemplate {
  sms?: string;
  emailSubject?: string;
  emailHtml?: string;
}

// Walks a dot-path like "soo.invoiceGenerated" against NotificationTemplates
function resolveTemplate(templateKey: string): ResolvedTemplate {
  const parts = templateKey.split(".");
  let node: any = NotificationTemplates;
  for (const part of parts) {
    node = node?.[part];
  }
  if (!node) {
    throw new Error(`Template not found for key "${templateKey}"`);
  }
  return node as ResolvedTemplate;
}

// Termii (and other gateways) sometimes return error as an array of field/issue
// objects rather than a string — failReason is a Prisma String column, so this
// must always come out as a plain string no matter what shape went in.
function stringifyError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error == null) return "Unknown error";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}


/**
 * Send a notification across one or more channels using a template, and log each attempt.
 * Returns per-channel results so the caller can see what succeeded/failed.
 */
export async function notify({ userId, to, templateKey, vars, channels }: NotifyParams) {
  const template = resolveTemplate(templateKey);
  const results: Record<string, { success: boolean; error?: string; skipped?: boolean }> = {};
 
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyByEmail: true, notifyBySms: true, notifyByInApp: true },
  });
 
  const isChannelEnabled = (channel: Channel): boolean => {
    if (!user) return true; // fail open — don't silently drop notifications over a missing lookup
    if (channel === "sms") return user.notifyBySms;
    if (channel === "email") return user.notifyByEmail;
    return true;
  };
 
  for (const channel of channels) {
    if (!isChannelEnabled(channel)) {
      const skippedRecord = await prisma.notification.create({
        data: {
          channel: channel as any,
          status: "skipped" as any,
          message: `Skipped — user has ${channel} notifications disabled`,
          userId,
        },
      });
      results[channel] = { success: false, skipped: true };
      continue;
    }
 
    if (channel === "sms") {
      if (!template.sms) {
        results.sms = { success: false, error: `No sms template for "${templateKey}"` };
        continue;
      }
      if (!to.phone) {
        results.sms = { success: false, error: "No phone number provided" };
        continue;
      }
 
      const message = interpolate(template.sms, vars);
 
      // Log as pending first so you have a record even if the process crashes mid-send
      const record = await prisma.notification.create({
        data: {
          channel: "sms" as any, // TODO: replace with your Prisma enum, e.g. NotificationChannel.sms
          status: "pending" as any, // TODO: replace with NotificationStatus.pending
          message,
          userId,
        },
      });
 
      const result = await sendSms({ to: to.phone, message });
 
      await prisma.notification.update({
        where: { id: record.id },
        data: result.success
          ? { status: "sent" as any, sentAt: new Date() }
          : { status: "failed" as any, failReason: stringifyError(result.error) },
      });
 
      results.sms = { success: result.success, error: result.error };
    }
 
    if (channel === "email") {
      if (!template.emailHtml || !template.emailSubject) {
        results.email = { success: false, error: `No email template for "${templateKey}"` };
        continue;
      }
      if (!to.email) {
        results.email = { success: false, error: "No email address provided" };
        continue;
      }
 
      const subject = interpolate(template.emailSubject, vars);
      const html = interpolate(template.emailHtml, vars);
 
      const record = await prisma.notification.create({
        data: {
          channel: "email" as any, // TODO: replace with NotificationChannel.email
          status: "pending" as any, // TODO: replace with NotificationStatus.pending
          subject,
          message: html,
          userId,
        },
      });
 
      const result = await sendEmail({ to: to.email, subject, html });
 
      await prisma.notification.update({
        where: { id: record.id },
        data: result.success
          ? { status: "sent" as any, sentAt: new Date() }
          : { status: "failed" as any, failReason: stringifyError(result.error) },
      });
 
      results.email = { success: result.success, error: result.error };
    }
  }
 
  return results;
}