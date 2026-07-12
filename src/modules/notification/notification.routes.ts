
import { Router } from "express";
import { getMyNotifications, markAllNotificationsRead, markNotificationRead, sendNotificationController } from "./notification.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const router = Router();

router.use(requireAuth)
router.post("/send", sendNotificationController);
router.patch("/:id/read", markNotificationRead);
router.get("/", getMyNotifications);
router.patch("/read-all", markAllNotificationsRead);



export default router;