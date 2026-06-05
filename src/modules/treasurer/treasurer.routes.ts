// src/modules/treasurer/treasurer.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  createLevyConfig,
  listLevyConfigs,
  getLevyConfigById,
  updateLevyConfig,
  toggleLevyConfig,
  getRevenueOverview,
  getRevenueByOfficer,
  getRevenueByWard,
  getReconciliation,
  getAllInvoices,
  getInvoiceById,
  markInvoiceOverdue,
  updatePermitConfig,
  createPermitConfig,
  listPermitConfigs,
} from './treasurer.controller';
import {
  createLevyConfigSchema,
  createPermitConfigSchema,
  listLevyConfigsSchema,
  listPermitConfigsSchema,
  updateLevyConfigSchema,
  updatePermitConfigSchema,
} from './treasurer.validation';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Treasurer Operations
 *     description: Levy configuration management and revenue analytics for LGA Treasurer
 */

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     RevenueCategory:
 *       type: string
 *       enum: [market_taxes, tenement_rates, signboard_fees, livestock_fees, trade_permit, other_revenue]
 *     BillingCycle:
 *       type: string
 *       enum: [daily, weekly, monthly, yearly]
 *     InvoiceStatus:
 *       type: string
 *       enum: [draft, sent, paid, partially_paid, overdue, cancelled]
 *     DateRange:
 *       type: object
 *       properties:
 *         from:
 *           type: string
 *           format: date
 *         to:
 *           type: string
 *           format: date
 */

// Enforce strict treasury access - only treasurer, finance, or super admin
router.use(requireAuth, requireRole('treasurer', 'super_admin'));

// ============================================================
// LEVY CONFIGURATION MANAGEMENT
// ============================================================

/**
 * @openapi
 * /treasurer/levy-configs:
 *   post:
 *     tags: [Treasurer Operations]
 *     summary: Create a new levy pricing configuration
 *     description: Treasurer creates levy rates for different revenue categories. Only one active config per category recommended.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - amount
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 description: Display name of the levy
 *                 example: "Annual Market Stall Levy"
 *               category:
 *                 $ref: '#/components/schemas/RevenueCategory'
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Detailed description of the levy
 *                 example: "Annual fee for market stall operators in designated markets"
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 description: Levy amount in local currency (₦)
 *                 example: 25000
 *               billingCycle:
 *                 $ref: '#/components/schemas/BillingCycle'
 *                 default: yearly
 *               penaltyRate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Late payment penalty percentage
 *                 example: 10
 *               effectiveFrom:
 *                 type: string
 *                 format: date
 *                 description: Date when levy becomes active
 *                 example: "2024-01-01"
 *               effectiveTo:
 *                 type: string
 *                 format: date
 *                 description: Optional expiry date for the levy
 *                 example: "2024-12-31"
 *     responses:
 *       201:
 *         description: Levy configuration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     config:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         category:
 *                           type: string
 *                         amount:
 *                           type: number
 *                         billingCycle:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                         effectiveFrom:
 *                           type: string
 *                           format: date
 *                         effectiveTo:
 *                           type: string
 *                           format: date
 *                     warning:
 *                       type: string
 *                       description: Warning if another active config exists for this category
 *                     existingConfigId:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient role permissions
 */
router.post(
  '/levy-configs',
  validateBody(createLevyConfigSchema),
  createLevyConfig
);

/**
 * @openapi
 * /treasurer/levy-configs:
 *   get:
 *     tags: [Treasurer Operations]
 *     summary: List all levy configurations
 *     description: Retrieve levy configs with optional filters for category and active status
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           $ref: '#/components/schemas/RevenueCategory'
 *         description: Filter by revenue category
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of levy configurations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       category:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       billingCycle:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 *                       effectiveFrom:
 *                         type: string
 *                         format: date
 *                       effectiveTo:
 *                         type: string
 *                         format: date
 *                         nullable: true
 *                       _count:
 *                         type: object
 *                         properties:
 *                           invoices:
 *                             type: integer
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get(
  '/levy-configs',
  validateQuery(listLevyConfigsSchema),
  listLevyConfigs
);

/**
 * @openapi
 * /treasurer/levy-configs/{id}:
 *   get:
 *     tags: [Treasurer Operations]
 *     summary: Get levy configuration by ID
 *     description: Retrieve detailed information about a specific levy configuration
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Levy configuration UUID
 *     responses:
 *       200:
 *         description: Levy configuration details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     category:
 *                       type: string
 *                     description:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     billingCycle:
 *                       type: string
 *                     penaltyRate:
 *                       type: number
 *                     isActive:
 *                       type: boolean
 *                     effectiveFrom:
 *                       type: string
 *                       format: date
 *                     effectiveTo:
 *                       type: string
 *                       format: date
 *                       nullable: true
 *                     configuredBy:
 *                       type: object
 *                     _count:
 *                       type: object
 *                       properties:
 *                         invoices:
 *                           type: integer
 *       404:
 *         description: Levy configuration not found
 */
router.get('/levy-configs/:id', getLevyConfigById);

/**
 * @openapi
 * /treasurer/levy-configs/{id}:
 *   patch:
 *     tags: [Treasurer Operations]
 *     summary: Update a levy configuration
 *     description: Modify levy amount, billing cycle, penalty rate, or other settings
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               billingCycle:
 *                 $ref: '#/components/schemas/BillingCycle'
 *               penaltyRate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               effectiveTo:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Levy configuration updated
 *       404:
 *         description: Levy configuration not found
 */
router.patch(
  '/levy-configs/:id',
  validateBody(updateLevyConfigSchema),
  updateLevyConfig
);

/**
 * @openapi
 * /treasurer/levy-configs/{id}/toggle:
 *   patch:
 *     tags: [Treasurer Operations]
 *     summary: Activate or deactivate a levy configuration
 *     description: Toggle the active status of a levy configuration (soft disable without deletion)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Levy configuration toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *                   example: "Levy configuration activated"
 *       404:
 *         description: Levy configuration not found
 */
router.patch('/levy-configs/:id/toggle', toggleLevyConfig);

// ============================================================
// REVENUE ANALYTICS
// ============================================================

/**
 * @openapi
 * /treasurer/revenue:
 *   get:
 *     tags: [Treasurer Operations]
 *     summary: System-wide revenue overview
 *     description: Comprehensive revenue analytics including totals, category breakdown, status distribution, payment methods, and daily trends
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for revenue period (defaults to start of current month)
 *         example: "2024-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for revenue period (defaults to current date)
 *         example: "2024-12-31"
 *     responses:
 *       200:
 *         description: Revenue overview statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       $ref: '#/components/schemas/DateRange'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalInvoiced:
 *                           type: number
 *                         totalCollected:
 *                           type: number
 *                         totalOutstanding:
 *                           type: number
 *                         totalInvoices:
 *                           type: integer
 *                         collectionRate:
 *                           type: string
 *                           example: "75.5%"
 *                     byCategory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                           invoiced:
 *                             type: number
 *                           collected:
 *                             type: number
 *                           invoiceCount:
 *                             type: integer
 *                     byStatus:
 *                       type: array
 *                     byPaymentMethod:
 *                       type: array
 *                     dailyTrend:
 *                       type: array
 */
router.get('/revenue', getRevenueOverview);

/**
 * @openapi
 * /treasurer/revenue/by-officer:
 *   get:
 *     tags: [Treasurer Operations]
 *     summary: Revenue breakdown by field officer
 *     description: Analyze revenue collection performance per field officer or contractor
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Revenue by officer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       $ref: '#/components/schemas/DateRange'
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           officer:
 *                             type: object
 *                           collected:
 *                             type: number
 *                           invoiced:
 *                             type: number
 *                           transactions:
 *                             type: integer
 */
router.get('/revenue/by-officer', getRevenueByOfficer);

/**
 * @openapi
 * /treasurer/revenue/by-ward:
 *   get:
 *     tags: [Treasurer Operations]
 *     summary: Revenue breakdown by ward
 *     description: Analyze revenue collection performance across different wards
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Revenue by ward
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       $ref: '#/components/schemas/DateRange'
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           ward:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               code:
 *                                 type: string
 *                           invoiced:
 *                             type: number
 *                           collected:
 *                             type: number
 *                           invoiceCount:
 *                             type: integer
 */
router.get('/revenue/by-ward', getRevenueByWard);

// ============================================================
// RECONCILIATION
// ============================================================

/**
 * @openapi
 * /treasurer/reconciliation:
 *   get:
 *     tags: [Treasurer Operations]
 *     summary: Invoice vs payment reconciliation report
 *     description: Detailed reconciliation showing what was issued, collected, and outstanding with full audit trail
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Reconciliation report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       $ref: '#/components/schemas/DateRange'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalInvoiced:
 *                           type: number
 *                         totalCollected:
 *                           type: number
 *                         totalOutstanding:
 *                           type: number
 *                         variance:
 *                           type: number
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                     meta:
 *                       type: object
 */
router.get('/reconciliation', getReconciliation);

// ============================================================
// INVOICE MANAGEMENT (Treasurer Read-Only)
// ============================================================

/**
 * @openapi
 * /treasurer/invoices:
 *   get:
 *     tags: [Treasurer Operations]
 *     summary: System-wide invoice list
 *     description: Retrieve all invoices with comprehensive filtering options
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/InvoiceStatus'
 *       - in: query
 *         name: category
 *         schema:
 *           $ref: '#/components/schemas/RevenueCategory'
 *       - in: query
 *         name: officerId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by assigned officer
 *       - in: query
 *         name: businessId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by business
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: List of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       invoiceNumber:
 *                         type: string
 *                       category:
 *                         type: string
 *                       status:
 *                         type: string
 *                       totalAmount:
 *                         type: number
 *                       balanceDue:
 *                         type: number
 *                       dueDate:
 *                         type: string
 *                         format: date
 *                       business:
 *                         type: object
 *                       assignedOfficer:
 *                         type: object
 *                       receipt:
 *                         type: object
 *                         nullable: true
 *                 meta:
 *                   type: object
 */
router.get('/invoices', getAllInvoices);

/**
 * @openapi
 * /treasurer/invoices/{id}:
 *   get:
 *     tags: [Treasurer Operations]
 *     summary: Get invoice by ID
 *     description: Retrieve detailed invoice information including full payment trail
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invoice details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     invoiceNumber:
 *                       type: string
 *                     status:
 *                       type: string
 *                     totalAmount:
 *                       type: number
 *                     amountPaid:
 *                       type: number
 *                     balanceDue:
 *                       type: number
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                     receipt:
 *                       type: object
 *                       nullable: true
 *                     permit:
 *                       type: object
 *                       nullable: true
 *       404:
 *         description: Invoice not found
 */
router.get('/invoices/:id', getInvoiceById);

/**
 * @openapi
 * /treasurer/invoices/{id}/mark-overdue:
 *   patch:
 *     tags: [Treasurer Operations]
 *     summary: Mark invoice as overdue with penalty
 *     description: Manually mark an overdue invoice and apply penalty based on levy configuration
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invoice marked as overdue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *                   example: "Invoice marked overdue. Penalty of ₦2500 applied."
 *       400:
 *         description: Cannot mark paid or cancelled invoice as overdue
 *       404:
 *         description: Invoice not found
 */
router.patch('/invoices/:id/mark-overdue', markInvoiceOverdue);


// ===================== permit config

/**
 * @openapi
 * /treasurer/permit-configs:
 * get:
 * tags: [Treasurer Operations]
 * summary: List all permit configurations
 * description: Retrieve permit configs with optional filters for category and active status
 * security:
 * - BearerAuth: []
 * parameters:
 * - in: query
 * name: category
 * schema:
 * $ref: '#/components/schemas/RevenueCategory'
 * description: Filter by revenue category umbrella
 * - in: query
 * name: isActive
 * schema:
 * type: boolean
 * description: Filter by active status
 * - in: query
 * name: page
 * schema:
 * type: integer
 * default: 1
 * description: Page number
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * default: 20
 * description: Items per page
 * responses:
 * 200:
 * description: List of permit configurations
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * success:
 * type: boolean
 * data:
 * type: array
 * items:
 * type: object
 * properties:
 * id:
 * type: string
 * name:
 * type: string
 * code:
 * type: string
 * category:
 * type: string
 * baseAmount:
 * type: number
 * isActive:
 * type: boolean
 * _count:
 * type: object
 * properties:
 * permits:
 * type: integer
 * meta:
 * type: object
 * properties:
 * total:
 * type: integer
 * page:
 * type: integer
 * limit:
 * type: integer
 * totalPages:
 * type: integer
 */
router.get(
  '/permit-configs',
  validateQuery(listPermitConfigsSchema),
  listPermitConfigs
);

/**
 * @openapi
 * /treasurer/permit-configs:
 * post:
 * tags: [Treasurer Operations]
 * summary: Create a new permit configuration
 * description: Provision a new permit tier matrix with base pricing setup
 * security:
 * - BearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [name, code, category, baseAmount]
 * properties:
 * name:
 * type: string
 * code:
 * type: string
 * category:
 * $ref: '#/components/schemas/RevenueCategory'
 * baseAmount:
 * type: number
 * minimum: 0
 * responses:
 * 201:
 * description: Permit configuration created successfully
 */
router.post(
  '/permit-configs',
  validateBody(createPermitConfigSchema),
  createPermitConfig
);

/**
 * @openapi
 * /treasurer/permit-configs/{id}:
 * patch:
 * tags: [Treasurer Operations]
 * summary: Update a permit configuration or toggle status
 * description: Modify permit baseline metrics or deactivate/activate execution rules
 * security:
 * - BearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * format: uuid
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * name:
 * type: string
 * baseAmount:
 * type: number
 * minimum: 0
 * isActive:
 * type: boolean
 * responses:
 * 200:
 * description: Permit configuration updated successfully
 * 404:
 * description: Permit configuration variant not found
 */
router.patch(
  '/permit-configs/:id',
  validateBody(updatePermitConfigSchema),
  updatePermitConfig
);

export default router;