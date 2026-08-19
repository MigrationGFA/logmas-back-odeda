// src/modules/fieldOfficer/fieldOfficer.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorize.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  // registerBusiness,
  // generateInvoice,
  recordPayment,
  // issuePermit,
  verifyReceipt,
  getMyCollections,
  getCollectionSummary,
  // getAllWardBusinesses,
  // getWardPermits,
  // issueDemandNotice,
  logViolation,
} from './field.controller';
import {
  registerBusinessSchema,
  generateInvoiceSchema,
  recordPaymentSchema,
  issuePermitSchema,
  collectionsQuerySchema,
} from './field.validation';

const router = Router();

// All field officer routes require auth + role guard
const guard = [requireAuth, requireRole('field_officer')];

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
// router.post('/businesses', ...guard, validateBody(registerBusinessSchema), registerBusiness);

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
// router.get('/businesses', ...guard, getAllWardBusinesses);

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
// router.post('/invoices', ...guard, validateBody(generateInvoiceSchema), generateInvoice);

// ── PAYMENTS ──────────────────────────────────────────────────

/**
 * @openapi
 * /field-officer/invoices/:invoiceId/collect:
 *   post:
 *     tags: [Field Officer]
 *     summary: Record a cash or POS payment — auto-generates receipt on full payment
 *     security:
 *       - BearerAuth: []
 */
router.post('/invoices/:invoiceId/collect', ...guard, validateBody(recordPaymentSchema), recordPayment);

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
// router.post('/permits/:permitId/demand-notice', ...guard, issueDemandNotice);

/**
 * @openapi
 * /field-officer/permits:
 *   get:
 *     tags: [Field Officer]
 *     summary: Get permitst hub
 *     security:
 *       - BearerAuth: []
 */
// router.get('/permits', ...guard, getWardPermits);

router.post('/violations', ...guard, logViolation);

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
router.get('/receipts/verify/:code', requireAuth, verifyReceipt);

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
router.get('/collections/summary', ...guard, getCollectionSummary);

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
router.get('/collections', ...guard, validateQuery(collectionsQuerySchema), getMyCollections);

export default router;