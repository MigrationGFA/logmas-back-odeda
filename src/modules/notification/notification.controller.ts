// src/notifications/notification.controller.ts

import { NextFunction, Request, Response } from "express";
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


import { sendError, sendSuccess } from "../../utils/response";
import { prisma } from "../../utils/prisma";

// GET /api/v1/notifications/my?page=1&limit=20
export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return sendSuccess(res, { items, unreadCount, page, limit }); // TODO: match your sendSuccess path
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/notifications/:id/read
export const markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({ where: { id: String(id) } });
    if (!notification || notification.userId !== userId) {
      return sendError(res, "Notification not found", "NOT_FOUND", null, 404); // TODO: match your sendError path
    }

    const updated = await prisma.notification.update({
      where: { id: String(id) },
      data: { isRead: true, readAt: new Date() },
    });

    return sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/notifications/read-all
export const markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return sendSuccess(res, { message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
};

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