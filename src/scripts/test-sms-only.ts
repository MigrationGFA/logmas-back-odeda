// scripts/test-sms-only.ts
//
// Isolated SMS test — skips SMTP entirely so it doesn't hang on the network block.
// Run with: npx ts-node src/scripts/test-sms-only.ts

import "dotenv/config";
import { sendSms } from "../modules/notification/sms.service";
import { interpolate, NotificationTemplates } from "../config/notification.template";


const TEST_PHONE = "2348130822299"; // Termii wants no leading "+"

async function main() {
  console.log("Using Sender ID:", process.env.TERMII_SENDER_ID);
  console.log("Using channel:", process.env.TERMII_CHANNEL ?? "dnd");

  console.log("\n=== 1. Plain test SMS ===");
  const plainResult = await sendSms({
    to: TEST_PHONE,
    message: "Test SMS from Ijebu North East LGA backend — Termii wiring check.",
  });
  console.log(plainResult);

  console.log("\n=== 2. Templated SMS (soo.invoiceGenerated) ===");
  const template = NotificationTemplates.soo.invoiceGenerated;
  const templatedResult = await sendSms({
    to: TEST_PHONE,
    message: interpolate(template.sms, {
      applicant_name: "Evans (Test)",
      application_id: "TEST-0001",
      payment_amount: "₦5,000",
      checkout_link: "https://ijebunortheastlga.gov.ng/pay/test",
    }),
  });
  console.log(templatedResult);
}

main().catch(console.error);