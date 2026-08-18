import { Router } from 'express';
// import { getReceipts, getReceiptById } from './receipt.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/v1/receipts:
 * get:
 * summary: Retrieve a list of verified digital receipts
 * description: Fetches all paid transactions. Output matches public role and team isolation matrices.
 * tags: [Receipts]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Array of available receipts returned successfully inside the global envelope.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status:
 * type: string
 * example: success
 * data:
 * type: array
 * items:
 * type: object
 * properties:
 * id:
 * type: string
 * example: "rcpt-83921-uuid"
 * receiptNumber:
 * type: string
 * example: "REC-2026-9481"
 * amount:
 * type: number
 * example: 25000
 * customerName:
 * type: string
 * example: "Alhaji Kunle Ventures"
 * levyType:
 * type: string
 * example: "Harmattan Trade License"
 * paidAt:
 * type: string
 * format: date-time
 * example: "2026-06-04T18:00:00.000Z"
 * paymentMethod:
 * type: string
 * example: "online"
 * invoiceId:
 * type: string
 * example: "inv-3012-uuid"
 * error:
 * type: string
 * nullable: true
 * example: null
 */
// router.get('/', getReceipts);

/**
 * @openapi
 * /api/v1/receipts/{id}:
 * get:
 * summary: Fetch a single official receipt details container
 * description: Queries database by matching explicit unique row ID fields or sequential human-readable receipt numbers.
 * tags: [Receipts]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: Database primary key UUID/CUID string OR sequential Receipt Reference Number.
 * responses:
 * 200:
 * description: Complete validated transactional snapshot returned.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status:
 * type: string
 * example: success
 * data:
 * type: object
 * properties:
 * id:
 * type: string
 * receiptNumber:
 * type: string
 * example: "REC-2026-9481"
 * verificationCode:
 * type: string
 * example: "V-CODE-83910"
 * invoiceRef:
 * type: string
 * example: "INV-8401"
 * invoiceId:
 * type: string
 * paymentMethod:
 * type: string
 * amount:
 * type: number
 * paidAt:
 * type: string
 * customerName:
 * type: string
 * phone:
 * type: string
 * levyType:
 * type: string
 * officerName:
 * type: string
 * nullable: true
 * invoice:
 * type: object
 * properties:
 * address:
 * type: string
 * example: "No. 14 Market Square, Ijebu North East"
 * 404:
 * description: Target resource was missing or access validation rejected.
 */
// router.get('/:id', getReceiptById);

export default router;