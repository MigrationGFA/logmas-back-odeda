// src/notifications/notification.controller.ts

import { Request, Response } from "express";
import { notify } from "./notification.service";

// POST /notifications/send
// Generic endpoint — body shape matches `notify()` params directly.
// {
//   "userId": "uuid",
//   "to": { "phone": "2348012345678", "email": "someone@example.com" },
//   "templateKey": "soo.invoiceGenerated",
//   "vars": { "applicant_name": "John", "application_id": "1234", "payment_amount": "₦5,000", "checkout_link": "https://..." },
//   "channels": ["sms", "email"]
// }
export async function sendNotificationController(req: Request, res: Response) {
  const { userId, to, templateKey, vars, channels } = req.body;

  if (!userId || !to || !templateKey || !vars || !channels) {
    return res.status(400).json({
      success: false,
      message: "userId, to, templateKey, vars, and channels are required",
    });
  }

  try {
    const results = await notify({ userId, to, templateKey, vars, channels });
    return res.status(200).json({ success: true, data: results });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/* Example route wiring (src/notifications/notification.routes.ts):

import { Router } from "express";
import { sendNotificationController } from "./notification.controller";

const router = Router();
router.post("/send", sendNotificationController);

export default router;

// then in your app entry: app.use("/notifications", notificationRoutes);
*/

/* Example real usage from your SOO application flow, once payment is confirmed:

import { notify } from "../notifications/notification.service";

await notify({
  userId: application.userId,
  to: { phone: applicant.phone, email: applicant.email },
  templateKey: "soo.paymentReceived",
  vars: {
    applicant_name: applicant.firstName,
    application_id: application.id,
    invoice_number: invoice.number,
    payment_amount: `₦${payment.amount.toLocaleString()}`,
  },
  channels: ["sms", "email"],
});
*/