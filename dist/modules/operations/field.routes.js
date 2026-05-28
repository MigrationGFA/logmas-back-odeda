"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/fieldOfficer/fieldOfficer.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const authorize_middleware_1 = require("../../middleware/authorize.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const field_controller_1 = require("./field.controller");
const field_validation_1 = require("./field.validation");
const router = (0, express_1.Router)();
// All field officer routes require auth + role guard
const guard = [auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('field_officer')];
// ── BUSINESS ──────────────────────────────────────────────────
/**
 * @openapi
 * /field-officer/businesses:
 *   post:
 *     tags: [Field Officer]
 *     summary: Register a business manually in the field
 *     security:
 *       - BearerAuth: []
 */
router.post('/businesses', ...guard, (0, validate_middleware_1.validateBody)(field_validation_1.registerBusinessSchema), field_controller_1.registerBusiness);
/**
 * @openapi
 * /field-officer/businesses:
 *   get:
 *     tags: [Field Officer]
 *     summary: Search for existing businesses
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: wardId
 *         schema:
 *           type: string
 */
router.get('/businesses', ...guard, field_controller_1.searchBusinesses);
// ── INVOICES ──────────────────────────────────────────────────
/**
 * @openapi
 * /field-officer/invoices:
 *   post:
 *     tags: [Field Officer]
 *     summary: Generate an invoice for a business
 *     security:
 *       - BearerAuth: []
 */
router.post('/invoices', ...guard, (0, validate_middleware_1.validateBody)(field_validation_1.generateInvoiceSchema), field_controller_1.generateInvoice);
// ── PAYMENTS ──────────────────────────────────────────────────
/**
 * @openapi
 * /field-officer/payments:
 *   post:
 *     tags: [Field Officer]
 *     summary: Record a cash or POS payment — auto-generates receipt on full payment
 *     security:
 *       - BearerAuth: []
 */
router.post('/payments', ...guard, (0, validate_middleware_1.validateBody)(field_validation_1.recordPaymentSchema), field_controller_1.recordPayment);
// ── PERMITS ───────────────────────────────────────────────────
/**
 * @openapi
 * /field-officer/permits:
 *   post:
 *     tags: [Field Officer]
 *     summary: Issue a permit immediately after payment is confirmed
 *     security:
 *       - BearerAuth: []
 */
router.post('/permits', ...guard, (0, validate_middleware_1.validateBody)(field_validation_1.issuePermitSchema), field_controller_1.issuePermit);
// ── RECEIPT VERIFICATION ──────────────────────────────────────
/**
 * @openapi
 * /field-officer/receipts/verify/{code}:
 *   get:
 *     tags: [Field Officer]
 *     summary: Verify a receipt by code or QR token in the field
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/receipts/verify/:code', ...guard, field_controller_1.verifyReceipt);
// ── COLLECTIONS ───────────────────────────────────────────────
/**
 * @openapi
 * /field-officer/collections/summary:
 *   get:
 *     tags: [Field Officer]
 *     summary: Get today's and all-time collection summary with category breakdown
 *     security:
 *       - BearerAuth: []
 */
router.get('/collections/summary', ...guard, field_controller_1.getCollectionSummary);
/**
 * @openapi
 * /field-officer/collections:
 *   get:
 *     tags: [Field Officer]
 *     summary: Get collection history — scoped to this officer only
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by date (YYYY-MM-DD). Defaults to today.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 */
router.get('/collections', ...guard, (0, validate_middleware_1.validateQuery)(field_validation_1.collectionsQuerySchema), field_controller_1.getMyCollections);
exports.default = router;
