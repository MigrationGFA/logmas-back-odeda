// src/payments/payment.routes.ts
import { Router } from "express";
import express from "express";
import { verifyPaystackPayment, paystackWebhook } from "./paystack.controller";
// import { authenticate } from "../middleware/auth"; // TODO: match your actual auth middleware import

const router = Router();

// GET /api/v1/payments/verify/:reference
// Called by the frontend on refresh / after redirect back from Paystack.
router.get("/verify/:reference", /* authenticate, */ verifyPaystackPayment);

// POST /api/v1/payments/webhook
// MUST use express.raw() here, not express.json() — Paystack signs the raw bytes.
// No auth middleware on this one — Paystack calls it directly, signature verification
// inside paystackWebhook is what proves it's really Paystack.
router.post("/webhook", express.raw({ type: "application/json" }), paystackWebhook);

export default router;