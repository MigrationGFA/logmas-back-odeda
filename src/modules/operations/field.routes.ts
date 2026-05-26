// field.routes.ts
import { Router } from 'express';
import { fieldRegisterBusiness, fieldCreateInvoice, fieldRecordPayment } from './field.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { 
  fieldRegisterBusinessSchema, 
  fieldCreateInvoiceSchema, 
  fieldRecordPaymentSchema 
} from './field.validation';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Field Operations
 *     description: Field officer endpoints for business registration, invoice creation, and on-the-spot payments
 */

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// Enforce strict operational gatekeeping - only field officers, supervisors, or super administrators can clear this line
router.use(requireAuth, requireRole('field_officer', 'contractor', 'super_admin'));

/**
 * @openapi
 * /field/businesses:
 *   post:
 *     tags: [Field Operations]
 *     summary: Register a business on behalf of the owner
 *     description: Field officers can register new businesses directly into the system. This is typically done during enumeration drives or when business owners are not digitally enrolled.
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
 *               - ownerId
 *             properties:
 *               businessName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Legal name of the business
 *                 example: "Doe Enterprises Ltd"
 *               ownerName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Full name of the business owner
 *                 example: "John Doe"
 *               address:
 *                 type: string
 *                 maxLength: 255
 *                 description: Physical business address
 *                 example: "42 Market Road, Ijebu"
 *               phone:
 *                 type: string
 *                 pattern: '^[0-9+\-\s()]+$'
 *                 description: Contact phone number
 *                 example: "+2348023456789"
 *               email:
 *                 type: string
 *                 format: email
 *                 nullable: true
 *                 description: Optional business email address
 *                 example: "business@doeenterprises.com"
 *               cacNumber:
 *                 type: string
 *                 maxLength: 50
 *                 nullable: true
 *                 description: Corporate Affairs Commission registration number (if registered)
 *                 example: "RC1234567"
 *               category:
 *                 type: string
 *                 enum: [retail, wholesale, services, manufacturing, agriculture, hospitality, other]
 *                 description: Business category classification
 *                 example: "retail"
 *               wardId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the ward where business is located
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               ownerId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the business owner (must exist in user table)
 *                 example: "987fcdeb-51a2-43d7-9abc-123456789012"
 *     responses:
 *       201:
 *         description: Business successfully registered
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
 *                     wardId:
 *                       type: string
 *                     ownerId:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: "Business entity registered successfully onto the ledger"
 *       400:
 *         description: Validation error
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
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient role permissions
 *       404:
 *         description: Ward not found
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
 *                   example: "Target ward configuration not found"
 *       409:
 *         description: CAC number already exists
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
 *                   example: "CAC identification registry conflict matching alternative business profile"
 */
router.post('/businesses', validateBody(fieldRegisterBusinessSchema), fieldRegisterBusiness);

/**
 * @openapi
 * /field/invoices:
 *   post:
 *     tags: [Field Operations]
 *     summary: Generate invoice on behalf of business
 *     description: Field officers can manually generate tax/levy invoices for businesses using pre-configured levy rates from the Treasurer.
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
 *               - category
 *               - description
 *               - levyConfigId
 *               - dueDate
 *             properties:
 *               businessId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the business being invoiced
 *                 example: "11111111-aaaa-4444-bbbb-222222222222"
 *               category:
 *                 type: string
 *                 enum: [market_taxes, tenement_rates, signboard_fees, livestock_fees, trade_permit, other_revenue]
 *                 description: Revenue category for the invoice
 *                 example: "market_taxes"
 *               description:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 255
 *                 description: Detailed description of the invoice purpose
 *                 example: "Annual market stall levy - Plot 12, Central Market"
 *               levyConfigId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the active levy configuration (set by Treasurer)
 *                 example: "33333333-cccc-4444-dddd-555555555555"
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 description: Payment due date for the invoice
 *                 example: "2024-12-31"
 *     responses:
 *       201:
 *         description: Invoice successfully generated
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
 *                       enum: [sent]
 *                     dueDate:
 *                       type: string
 *                       format: date
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     businessId:
 *                       type: string
 *                     createdById:
 *                       type: string
 *                     assignedOfficerId:
 *                       type: string
 *                 message:
 *                   type: string
 *                   example: "Field enforcement billing invoice compiled successfully"
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Levy configuration or business not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     levy_missing: "Active levy configuration price rules matrix missing"
 *                     business_missing: "Target business account record inactive or non-existent"
 */
router.post('/invoices', validateBody(fieldCreateInvoiceSchema), fieldCreateInvoice);

/**
 * @openapi
 * /field/payments/record:
 *   post:
 *     tags: [Field Operations]
 *     summary: Record on-the-spot payment (Cash/POS)
 *     description: Field officers can record direct payments from businesses, automatically generating receipts and issuing trade permits when fully paid. Supports partial payments with balance tracking.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceId
 *               - amount
 *               - method
 *             properties:
 *               invoiceId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the invoice being paid
 *                 example: "44444444-dddd-5555-eeee-666666666666"
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Payment amount (in local currency)
 *                 example: 25000.00
 *               method:
 *                 type: string
 *                 enum: [cash, pos, bank_transfer, cheque, ussd]
 *                 description: Payment method used
 *                 example: "cash"
 *               reference:
 *                 type: string
 *                 maxLength: 100
 *                 nullable: true
 *                 description: Transaction reference number (POS slip number, bank ref, etc.)
 *                 example: "POS-2024-123456"
 *               narration:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 description: Additional notes about the payment
 *                 example: "Cash payment received at market - Mr. John Doe"
 *     responses:
 *       200:
 *         description: Payment successfully recorded
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
 *                     invoice:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         amountPaid:
 *                           type: number
 *                         balanceDue:
 *                           type: number
 *                         status:
 *                           type: string
 *                           enum: [partially_paid, paid]
 *                         paidAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                     payment:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         amount:
 *                           type: number
 *                         method:
 *                           type: string
 *                         status:
 *                           type: string
 *                         reference:
 *                           type: string
 *                           nullable: true
 *                         confirmedAt:
 *                           type: string
 *                           format: date-time
 *                     receipt:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         receiptNumber:
 *                           type: string
 *                         verificationCode:
 *                           type: string
 *                         qrToken:
 *                           type: string
 *                         amountPaid:
 *                           type: number
 *                     permit:
 *                       type: object
 *                       nullable: true
 *                       description: Auto-generated trade permit if invoice category is 'trade_permit' and fully paid
 *                       properties:
 *                         id:
 *                           type: string
 *                         permitNumber:
 *                           type: string
 *                         verificationCode:
 *                           type: string
 *                         status:
 *                           type: string
 *                         validFrom:
 *                           type: string
 *                           format: date
 *                         validTo:
 *                           type: string
 *                           format: date
 *                 message:
 *                   type: string
 *                   example: "Payment verified and operational assets generated successfully"
 *       400:
 *         description: Invoice already fully settled
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
 *                   example: "Action rejected: Target invoice balances are already fully settled"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Invoice not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Target collection invoice does not exist"
 */
router.post('/payments/record', validateBody(fieldRecordPaymentSchema), fieldRecordPayment);

export default router;