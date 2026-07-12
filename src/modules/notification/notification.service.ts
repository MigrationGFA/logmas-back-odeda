// src/notifications/notification.service.ts — REPLACES the previous version

import { sendSms } from "./sms.service";
import { sendEmail } from "./email.service";
import { NotificationTemplates, interpolate, TemplateVars } from "../../config/notification.template";
import { prisma } from "../../utils/prisma";

type Channel = "sms" | "email"; // in-app is implicit, not something you "request" anymore

interface NotifyParams {
  userId: string;
  to: { phone?: string; email?: string };
  templateKey: string;
  vars: TemplateVars;
  channels: Channel[]; // which EXTRA channels to attempt beyond the always-on in-app row
}

interface ResolvedTemplate {
  sms?: string;
  emailSubject?: string;
  emailHtml?: string;
}

function resolveTemplate(templateKey: string): ResolvedTemplate {
  const parts = templateKey.split(".");
  let node: any = NotificationTemplates;
  for (const part of parts) node = node?.[part];
  if (!node) throw new Error(`Template not found for key "${templateKey}"`);
  return node as ResolvedTemplate;
}

function stringifyError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error == null) return "Unknown error";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// Picks whatever text makes sense for the in-app feed — prefers the email
// subject as a "title" and the sms text (usually the shortest, cleanest
// summary) as the body, falling back sensibly if only one exists.
function buildInAppContent(template: ResolvedTemplate, vars: TemplateVars) {
  const title = template.emailSubject ? interpolate(template.emailSubject, vars) : undefined;
  const message = template.sms
    ? interpolate(template.sms, vars)
    : template.emailSubject
      ? interpolate(template.emailSubject, vars)
      : "You have a new notification.";
  return { title, message };
}

export async function notify({ userId, to, templateKey, vars, channels }: NotifyParams) {
  const template = resolveTemplate(templateKey);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyByEmail: true, notifyBySms: true, notifyByInApp: true },
  });

  const wantsSms = channels.includes("sms");
  const wantsEmail = channels.includes("email");

  const smsEnabled = wantsSms && (user?.notifyBySms ?? true) && !!to.phone && !!template.sms;
  const emailEnabled =
    wantsEmail && (user?.notifyByEmail ?? true) && !!to.email && !!template.emailHtml && !!template.emailSubject;

  const { title, message } = buildInAppContent(template, vars);

  // ── One row, created up front as "pending" for whichever channels apply ──
  const record = await prisma.notification.create({
    data: {
      userId,
      templateKey,
      title,
      message,
      smsStatus: wantsSms ? (smsEnabled ? "pending" : "failed") : null,
      emailStatus: wantsEmail ? (emailEnabled ? "pending" : "failed") : null,
    },
  });

  // ── Fire whatever's enabled in parallel ──
  const [smsResult, emailResult] = await Promise.all([
    smsEnabled ? sendSms({ to: to.phone!, message: interpolate(template.sms!, vars) }) : null,
    emailEnabled
      ? sendEmail({
          to: to.email!,
          subject: interpolate(template.emailSubject!, vars),
          html: interpolate(template.emailHtml!, vars),
        })
      : null,
  ]);

  // ── One update, writing back both channel outcomes at once ──
  await prisma.notification.update({
    where: { id: record.id },
    data: {
      ...(smsResult
        ? smsResult.success
          ? { smsStatus: "sent", smsSentAt: new Date() }
          : { smsStatus: "failed", smsFailReason: stringifyError(smsResult.error) }
        : {}),
      ...(emailResult
        ? emailResult.success
          ? { emailStatus: "sent", emailSentAt: new Date() }
          : { emailStatus: "failed", emailFailReason: stringifyError(emailResult.error) }
        : {}),
    },
  });

  return {
    notificationId: record.id,
    sms: smsEnabled ? { success: smsResult!.success, error: smsResult!.error, skipped: false } : wantsSms ? { success: false, skipped: true } : undefined,
    email: emailEnabled ? { success: emailResult!.success, error: emailResult!.error, skipped: false } : wantsEmail ? { success: false, skipped: true } : undefined,
  };
}