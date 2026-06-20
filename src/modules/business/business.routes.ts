// src/modules/business/business.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorize.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  createBusiness,
  getMyBusiness,
  updateMyBusiness,
  applyForPermit,
  getMyPermits,
  getMyPermitById,
  renewPermit,
  getMyInvoices,
  getMyInvoiceById,
  verifyPermit,
} from './business.controller';
import {
  createBusinessSchema,
  updateBusinessSchema,
  applyPermitSchema,
  renewPermitSchema,
  listInvoicesSchema,
} from './business.validation';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Business & Permits
 *     description: Business registration, trade permit applications, and invoice management
 */

// ── PUBLIC (no auth) ──────────────────────────────────────────

/**
 * @openapi
 * /business/permits/verify/{code}:
 *   get:
 *     tags: [Business & Permits]
 *     summary: Public permit verification
 *     description: Verify the validity of a trade permit using verification code or QR token. No authentication required.
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Permit verification code or QR token
 *         example: "VER-ABC123XYZ"
 *     responses:
 *       200:
 *         description: Permit verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                       description: Whether permit is currently valid
 *                     status:
 *                       type: string
 *                       enum: [pending_payment, issued, expired, revoked]
 *                     isExpired:
 *                       type: boolean
 *                     permitNumber:
 *                       type: string
 *                     permitType:
 *                       type: string
 *                     category:
 *                       type: string
 *                     validFrom:
 *                       type: string
 *                       format: date
 *                     validTo:
 *                       type: string
 *                       format: date
 *                     issuedAt:
 *                       type: string
 *                       format: date-time
 *                     business:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         owner:
 *                           type: string
 *                         address:
 *                           type: string
 *                         category:
 *                           type: string
 *                         ward:
 *                           type: string
 *                     issuingAuthority:
 *                       type: string
 *       404:
 *         description: Permit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Permit not found or invalid verification code"
 */
router.get('/permits/verify/:code', verifyPermit);

// ── BUSINESS PROFILE ──────────────────────────────────────────

/**
 * @openapi
 * /business:
 *   post:
 *     tags: [Business & Permits]
 *     summary: Register a new business
 *     description: Business owners can register their business. Only one active business per user allowed.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessName
 *               - ownerName
 *               - address
 *               - phone
 *               - category
 *               - wardId
 *             properties:
 *               businessName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "John's Supermarket Ltd"
 *               ownerName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "John Doe"
 *               address:
 *                 type: string
 *                 maxLength: 255
 *                 example: "123 Main Street, Ijebu"
 *               phone:
 *                 type: string
 *                 pattern: '^[0-9+\-\s()]+$'
 *                 example: "+2348012345678"
 *               email:
 *                 type: string
 *                 format: email
 *                 nullable: true
 *                 example: "business@example.com"
 *               cacNumber:
 *                 type: string
 *                 maxLength: 50
 *                 nullable: true
 *                 example: "RC1234567"
 *               category:
 *                 type: string
 *                 enum: [retail, wholesale, services, manufacturing, agriculture, hospitality, other]
 *                 example: "retail"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 example: "Retail supermarket selling groceries and household items"
 *               wardId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       201:
 *         description: Business registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     businessName:
 *                       type: string
 *                     ownerName:
 *                       type: string
 *                     address:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *                       nullable: true
 *                     cacNumber:
 *                       type: string
 *                       nullable: true
 *                     category:
 *                       type: string
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     isActive:
 *                       type: boolean
 *                     ward:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - requires business_owner role
 *       404:
 *         description: Ward not found
 *       409:
 *         description: Active business already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "You already have an active registered business. Update it instead."
 */
router.post(
  '/',
  requireAuth,
  requireRole('business_owner',"field_officer"),
  validateBody(createBusinessSchema),
  createBusiness
);

/**
 * @openapi
 * /business/my:
 *   get:
 *     tags: [Business & Permits]
 *     summary: Get my business profile
 *     description: Retrieve the authenticated business owner's active business profile with recent permits
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Business profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     businessName:
 *                       type: string
 *                     ownerName:
 *                       type: string
 *                     address:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *                       nullable: true
 *                     cacNumber:
 *                       type: string
 *                       nullable: true
 *                     category:
 *                       type: string
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     isActive:
 *                       type: boolean
 *                     ward:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         code:
 *                           type: string
 *                     permits:
 *                       type: array
 *                       description: Recent permits (last 5)
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           permitNumber:
 *                             type: string
 *                           permitType:
 *                             type: string
 *                           status:
 *                             type: string
 *                           validFrom:
 *                             type: string
 *                             format: date
 *                           validTo:
 *                             type: string
 *                             format: date
 *       404:
 *         description: No registered business found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "No registered business found. Please register your business first."
 */
router.get('/my', requireAuth, requireRole('business_owner'), getMyBusiness);

/**
 * @openapi
 * /business/my:
 *   patch:
 *     tags: [Business & Permits]
 *     summary: Update my business profile
 *     description: Update the authenticated business owner's active business information
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               ownerName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               address:
 *                 type: string
 *                 maxLength: 255
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               cacNumber:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [retail, wholesale, services, manufacturing, agriculture, hospitality, other]
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               wardId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Business profile updated successfully
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
 *       404:
 *         description: No active business found
 */
router.patch(
  '/my',
  requireAuth,
  requireRole('business_owner'),
  validateBody(updateBusinessSchema),
  updateMyBusiness
);

// ── PERMITS ───────────────────────────────────────────────────

/**
 * @openapi
 * /business/permits:
 *   post:
 *     tags: [Business & Permits]
 *     summary: Apply for a trade permit
 *     description: Submit an application for a new trade permit. Creates invoice for payment automatically.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessId
 *               - permitType
 *               - category
 *             properties:
 *               businessId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the business applying for permit
 *               permitType:
 *                 type: string
 *                 enum: [trade, operational, signboard, hawking, special]
 *                 description: Type of permit requested
 *               category:
 *                 type: string
 *                 enum: [market_taxes, tenement_rates, signboard_fees, livestock_fees, other_revenue]
 *                 description: Revenue category for levy calculation
 *               validFrom:
 *                 type: string
 *                 format: date
 *                 description: Start date for permit validity (defaults to current date)
 *     responses:
 *       201:
 *         description: Permit application submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     permit:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         permitNumber:
 *                           type: string
 *                         verificationCode:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [pending_payment]
 *                     invoice:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         totalAmount:
 *                           type: number
 *                         status:
 *                           type: string
 *                     paymentNote:
 *                       type: string
 *                 message:
 *                   type: string
 *       403:
 *         description: Business does not belong to user
 *       409:
 *         description: Active permit already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "An active or pending permit of this type already exists for this business"
 */
router.post(
  '/permits',
  requireAuth,
  requireRole('business_owner',"field_officer"),
  validateBody(applyPermitSchema),
  applyForPermit
);

/**
 * @openapi
 * /business/permits:
 *   get:
 *     tags: [Business & Permits]
 *     summary: List all my permits
 *     description: Retrieve all permits for the authenticated business owner's active business
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of permits retrieved
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
 *                       permitNumber:
 *                         type: string
 *                       permitType:
 *                         type: string
 *                       category:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [pending_payment, issued, expired, revoked]
 *                       validFrom:
 *                         type: string
 *                         format: date
 *                       validTo:
 *                         type: string
 *                         format: date
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       invoice:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           status:
 *                             type: string
 *                           totalAmount:
 *                             type: number
 *                           balanceDue:
 *                             type: number
 *                           paidAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *       404:
 *         description: No active business found
 */
router.get('/permits', requireAuth, requireRole('business_owner'), getMyPermits);

/**
 * @openapi
 * /business/permits/{id}:
 *   get:
 *     tags: [Business & Permits]
 *     summary: Get a specific permit by ID
 *     description: Retrieve detailed information about a specific permit including business and invoice details
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Permit ID
 *     responses:
 *       200:
 *         description: Permit details retrieved
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
 *                     permitNumber:
 *                       type: string
 *                     verificationCode:
 *                       type: string
 *                     qrToken:
 *                       type: string
 *                     status:
 *                       type: string
 *                     permitType:
 *                       type: string
 *                     category:
 *                       type: string
 *                     validFrom:
 *                       type: string
 *                       format: date
 *                     validTo:
 *                       type: string
 *                       format: date
 *                     business:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         businessName:
 *                           type: string
 *                         address:
 *                           type: string
 *                     invoice:
 *                       type: object
 *                     issuedBy:
 *                       type: object
 *       404:
 *         description: Permit not found
 */
router.get('/permits/:id', requireAuth, requireRole('business_owner',"field_officer"), getMyPermitById);

/**
 * @openapi
 * /business/permits/{id}/renew:
 *   post:
 *     tags: [Business & Permits]
 *     summary: Renew an existing permit
 *     description: Renew an issued or expired permit. Creates a new permit and invoice for the renewal period.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the permit to renew
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               validFrom:
 *                 type: string
 *                 format: date
 *                 description: Start date for renewed permit (defaults to current date)
 *     responses:
 *       200:
 *         description: Permit renewal initiated
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
 *                     permit:
 *                       type: object
 *                     invoice:
 *                       type: object
 *                     paymentNote:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Permit cannot be renewed (not issued or expired)
 *       404:
 *         description: Permit not found
 */
router.post(
  '/permits/:id/renew',
  requireAuth,
  requireRole('business_owner'),
  validateBody(renewPermitSchema),
  renewPermit
);

// ── INVOICES ──────────────────────────────────────────────────

/**
 * @openapi
 * /business/invoices:
 *   get:
 *     tags: [Business & Permits]
 *     summary: List all my business invoices
 *     description: Retrieve all invoices for the authenticated business owner's active business with pagination
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, sent, paid, overdue, cancelled]
 *         description: Filter by invoice status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of invoices retrieved
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
 *                       description:
 *                         type: string
 *                       subtotal:
 *                         type: number
 *                       totalAmount:
 *                         type: number
 *                       balanceDue:
 *                         type: number
 *                       status:
 *                         type: string
 *                       dueDate:
 *                         type: string
 *                         format: date
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       paidAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       levyConfig:
 *                         type: object
 *                         nullable: true
 *                       receipt:
 *                         type: object
 *                         nullable: true
 *                       permit:
 *                         type: object
 *                         nullable: true
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
 *       404:
 *         description: No active business found
 */
router.get(
  '/invoices',
  requireAuth,
  requireRole('business_owner'),
  validateQuery(listInvoicesSchema),
  getMyInvoices
);

/**
 * @openapi
 * /business/invoices/{id}:
 *   get:
 *     tags: [Business & Permits]
 *     summary: Get a specific invoice by ID
 *     description: Retrieve detailed invoice information including payments, receipt, and associated permit
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: Invoice details retrieved
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
 *                     category:
 *                       type: string
 *                     description:
 *                       type: string
 *                     subtotal:
 *                       type: number
 *                     totalAmount:
 *                       type: number
 *                     balanceDue:
 *                       type: number
 *                     status:
 *                       type: string
 *                     dueDate:
 *                       type: string
 *                       format: date
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     levyConfig:
 *                       type: object
 *                       nullable: true
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           method:
 *                             type: string
 *                           reference:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     receipt:
 *                       type: object
 *                       nullable: true
 *                     permit:
 *                       type: object
 *                       nullable: true
 *       404:
 *         description: Invoice not found
 */
router.get('/invoices/:id', requireAuth, requireRole('business_owner'), getMyInvoiceById);

export default router;