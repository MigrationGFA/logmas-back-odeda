// src/modules/payment/gpay.routes.ts
import { Router } from "express";
import express from "express";
import { z } from "zod";

import { requireAuth } from "../../middleware/auth.middleware";
import { validateBody } from "../../middleware/validate.middleware";
import {
  gpayWebhook,
  initializeGpayInvoicePayment,
  initializeGpayPublicPayment,
  verifyGpayPayment,
} from "./gpay.controller";

const router = Router();

// Parsing is attached per-route because this router is mounted BEFORE the global
// express.json() in app.ts. That ordering is deliberate: `/webhook` needs the
// raw request bytes for HMAC verification, and once express.json() has consumed
// the stream the raw body is gone for good.
const jsonBody = express.json();

export const gpayPublicInitializeSchema = z.object({
  serviceId: z.string().min(1),
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
});

// POST /api/v1/payments/gpay/webhook — GPay calls this. Signature verification
// happens inside gpayWebhook, so no auth middleware here.
router.post("/webhook", express.raw({ type: "application/json" }), gpayWebhook);

// GET /api/v1/payments/gpay/verify/:reference
// Public: the frontend calls this on refresh / after the redirect back from the
// checkout page.
router.get("/verify/:reference", verifyGpayPayment);

// POST /api/v1/payments/gpay/public/initialize
// Public "apply + pay first" flow — mirrors /api/v1/invoices/public/initialize
router.post(
  "/public/initialize",
  jsonBody,
  validateBody(gpayPublicInitializeSchema),
  initializeGpayPublicPayment,
);

// POST /api/v1/payments/gpay/initialize/:invoiceNumber
// Authenticated invoice payment — mirrors /api/v1/invoices/:id/pay-online
router.post(
  "/initialize/:invoiceNumber",
  jsonBody,
  requireAuth,
  initializeGpayInvoicePayment,
);

export default router;
