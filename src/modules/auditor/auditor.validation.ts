// src/modules/auditor/auditor.validation.ts
import { z } from 'zod';

export const auditLogFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  action: z.enum([
    'login', 'logout', 'login_failed', 'invoice_created', 'invoice_edited',
    'payment_confirmed', 'payment_reversed', 'receipt_generated', 'receipt_verified',
    'permit_issued', 'permit_revoked', 'application_submitted', 'application_approved',
    'application_rejected', 'certificate_issued', 'user_created', 'user_updated',
    'user_deleted', 'pricing_updated', 'complaint_raised', 'complaint_assigned',
    'complaint_resolved',
  ]).optional(),
  userId: z.string().uuid().optional(),
  entity: z.string().optional(),
  page: z.string().optional().transform((v) => parseInt(v || '1')),
  limit: z.string().optional().transform((v) => parseInt(v || '20')),
});

export const paymentFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  method: z.enum(['online_gateway', 'bank_transfer', 'virtual_account', 'pos', 'cash']).optional(),
  status: z.enum(['pending', 'confirmed', 'failed', 'reversed']).optional(),
  page: z.string().optional().transform((v) => parseInt(v || '1')),
  limit: z.string().optional().transform((v) => parseInt(v || '20')),
});

export const receiptFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  officerId: z.string().uuid().optional(),
  page: z.string().optional().transform((v) => parseInt(v || '1')),
  limit: z.string().optional().transform((v) => parseInt(v || '20')),
});

export const dateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.string().optional().transform((v) => parseInt(v || '1')),
  limit: z.string().optional().transform((v) => parseInt(v || '20')),
});