// invoices.routes.ts



import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { getInvoiceById, getInvoicesHubOverview, recordInvoicePayment } from './invoice.controller';
import { validateBody } from '../../middleware/validate.middleware';
import z from 'zod';
import { initializePaystackPayment, initializePaystackPaymentNewFlow } from '../payment/paystack.controller';
import { getInvoiceVirtualAccount } from '../payment/gpay.controller';

const router = Router();
// invoices.validation.ts
export const recordPaymentSchema = z.object({
  method:    z.enum(['pos', 'cash']),
  amount:    z.number().positive().optional(), // if not provided uses full balance
  reference: z.string().optional(),
  narration: z.string().optional(),
});


export default router;
router.get('/hub', requireAuth, getInvoicesHubOverview);

// Reserved virtual account details for this invoice. Registered BEFORE /:id
// so it can never be swallowed by the generic invoice route. Same handler is
// also mounted from gpay.routes.ts — both URLs work during rollout.
router.get(
  '/:invoiceNumber/virtual-account',
  requireAuth,
  getInvoiceVirtualAccount,
);

router.get('/:id',              requireAuth, getInvoiceById);
router.post('/:id/pay',         requireAuth, validateBody(recordPaymentSchema), recordInvoicePayment);
router.post("/:id/pay-online", requireAuth, initializePaystackPayment);
router.post("/public/initialize",  initializePaystackPaymentNewFlow);
// router.post('/:id/send-payment-link', requireAuth, sendPaymentLinkToBusiness);
// router.post('/:id/simulate-payment', requireAuth, simulatePayment); // dev only — remove in prod