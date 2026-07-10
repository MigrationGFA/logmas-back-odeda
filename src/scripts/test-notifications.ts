// scripts/test-notifications.ts
//
// Quick smoke test for the SMS + email services directly — no Prisma/userId needed.
// This is the fastest way to confirm your Termii + SMTP credentials actually work
// before wiring the full notify() + Notification-logging flow.
//
// Run with: npx ts-node scripts/test-notifications.ts
// (make sure your .env is loaded — add `import "dotenv/config";` at the top if you
// don't already load env vars elsewhere, and `npm install -D ts-node` if needed)

import "dotenv/config";
import { sendEmail, verifyConnection } from "../modules/notification/email.service";
import { sendSms } from "../modules/notification/sms.service";
import { interpolate, NotificationTemplates } from "../config/notification.template";

const TEST_PHONE = "+2348130822299";
const TEST_EMAIL = "evans@joemarineng.com";

async function main() {
  console.log("=== 1. Verifying SMTP connection ===");
  await verifyConnection();

//   console.log("\n=== 2. Sending test SMS ===");
//   const smsResult = await sendSms({
//     to: TEST_PHONE.replace("+", ""), // Termii expects no leading "+", e.g. 2348130822299
//     message: "Test SMS from Ijebu North East LGA backend — if you got this, Termii is wired correctly.",
//   });
//   console.log(smsResult);

  // console.log("\n=== 3. Sending test plain email ===");
  // const emailResult = await sendEmail({
  //   to: TEST_EMAIL,
  //   subject: "Test email — backend wiring check",
  //   html: "<p>If you're reading this, SMTP via cPanel is working.</p>",
  // });
  // console.log(emailResult);

  console.log("\n=== 4. Sending a real template (soo.invoiceGenerated) to both channels ===");
  const template = NotificationTemplates.soo.invoiceGenerated;
  const vars = {
    applicant_name: "Evans (Test)",
    application_id: "TEST-0001",
    payment_amount: "₦5,000",
    checkout_link: "https://ijebunortheastlga.gov.ng/pay/test",
  };

//   const smsTemplateResult = await sendSms({
//     to: TEST_PHONE.replace("+", ""),
//     message: interpolate(template.sms, vars),
//   });
//   console.log("SMS (templated):", smsTemplateResult);

  const emailTemplateResult = await sendEmail({
    to: TEST_EMAIL,
    subject: interpolate(template.emailSubject, vars),
    html: interpolate(template.emailHtml, vars),
  });
  console.log("Email (templated):", emailTemplateResult);
}

main().catch(console.error);