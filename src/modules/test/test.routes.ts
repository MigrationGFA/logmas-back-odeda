// src/dev/dev.routes.ts
import { Router } from "express";
import { checkSmtpStatus, testEmail, testSms } from "./test.controller";
// import { requireAuth } from "../middleware/auth"; // TODO: match your actual middleware

const router = Router();

router.get("/smtp-status", /* requireAuth, */ checkSmtpStatus);
router.post("/test-sms", /* requireAuth, */ testSms);
router.post("/test-email", /* requireAuth, */ testEmail);

export default router;

// Mount in your app entry: app.use("/api/v1/dev", devRoutes);