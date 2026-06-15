// src/modules/auditor/auditor.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorize.middleware';
import { validateQuery } from '../../middleware/validate.middleware';
import {
  getAuditLogs,
  getAuditLogById,
  getAllPayments,
  getPaymentById,
  getAllReceipts,
  verifyReceipt,
  getSuspiciousActivity,
  getReconciliation,
} from './auditor.controller';
import {
  auditLogFilterSchema,
  paymentFilterSchema,
  receiptFilterSchema,
  dateRangeSchema,
} from './auditor.validation';

const router = Router();

// Auditor and super_admin — all GET, no mutations
const guard = [requireAuth, requireRole('auditor', 'super_admin')];

// ── AUDIT LOGS ────────────────────────────────────────────────

/**
 * @openapi
 * /auditor/audit-logs:
 *   get:
 *     tags: [Auditor]
 *     summary: Full audit log — filterable by action, user, entity, date range
 *     security:
 *       - BearerAuth: []
 */
router.get('/audit-logs', ...guard, getAuditLogs);

/**
 * @openapi
 * /auditor/audit-logs/{id}:
 *   get:
 *     tags: [Auditor]
 *     summary: Single audit log entry
 *     security:
 *       - BearerAuth: []
 */
router.get('/audit-logs/:id', ...guard, getAuditLogById);

// ── PAYMENTS ──────────────────────────────────────────────────

/**
 * @openapi
 * /auditor/payments:
 *   get:
 *     tags: [Auditor]
 *     summary: All payments — filterable by method, status, date range
 *     security:
 *       - BearerAuth: []
 */
router.get('/payments', ...guard, validateQuery(paymentFilterSchema), getAllPayments);

/**
 * @openapi
 * /auditor/payments/{id}:
 *   get:
 *     tags: [Auditor]
 *     summary: Single payment with full invoice and business context
 *     security:
 *       - BearerAuth: []
 */
router.get('/payments/:id', ...guard, getPaymentById);

// ── RECEIPTS ──────────────────────────────────────────────────

/**
 * @openapi
 * /auditor/receipts:
 *   get:
 *     tags: [Auditor]
 *     summary: All receipts — filterable by officer and date range
 *     security:
 *       - BearerAuth: []
 */
router.get('/receipts', ...guard, validateQuery(receiptFilterSchema), getAllReceipts);

/**
 * @openapi
 * /auditor/receipts/verify/{code}:
 *   get:
 *     tags: [Auditor]
 *     summary: Verify a receipt by verification code or QR token
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/receipts/verify/:code', ...guard, verifyReceipt);

// ── SUSPICIOUS ACTIVITY ───────────────────────────────────────

/**
 * @openapi
 * /auditor/suspicious:
 *   get:
 *     tags: [Auditor]
 *     summary: Flagged suspicious payment activity — large transactions, orphaned confirmations, duplicate payments
 *     security:
 *       - BearerAuth: []
 */
router.get('/suspicious', ...guard, validateQuery(dateRangeSchema), getSuspiciousActivity);

// ── RECONCILIATION ────────────────────────────────────────────

/**
 * @openapi
 * /auditor/reconciliation:
 *   get:
 *     tags: [Auditor]
 *     summary: Invoice vs payment reconciliation — read-only view
 *     security:
 *       - BearerAuth: []
 */
router.get('/reconciliation', ...guard, validateQuery(dateRangeSchema), getReconciliation);

export default router;