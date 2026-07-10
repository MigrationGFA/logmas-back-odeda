// invoices.routes.ts



import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { getInvoiceById, getInvoicesHubOverview, recordInvoicePayment, simulatePayment } from './invoice.controller';
import { validateBody } from '../../middleware/validate.middleware';
import z from 'zod';
import { initializePaystackPayment, sendPaymentLinkToBusiness } from '../payment/paystack.controller';

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
router.get('/:id',              requireAuth, getInvoiceById);
router.post('/:id/pay',         requireAuth, validateBody(recordPaymentSchema), recordInvoicePayment);
router.post("/:id/pay-online", requireAuth, initializePaystackPayment);
router.post('/:id/send-payment-link', requireAuth, sendPaymentLinkToBusiness);
router.post('/:id/simulate-payment', requireAuth, simulatePayment); // dev only — remove in prod