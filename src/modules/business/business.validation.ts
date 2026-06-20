// src/modules/business/business.validation.ts
import { z } from 'zod';

export const createBusinessSchema = z.object({
  businessName: z.string().min(2, 'Business name is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  address: z.string().min(5, 'Business address is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email(),
  cacNumber: z.string().optional(),
  category: z.string().min(2, 'Business category is required'),
  description: z.string().optional(),
  wardId: z.string().uuid('Invalid ward ID'),
});

export const updateBusinessSchema = z.object({
  businessName: z.string().min(2).optional(),
  ownerName: z.string().min(2).optional(),
  address: z.string().min(5).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  cacNumber: z.string().optional(),
  category: z.string().min(2).optional(),
  description: z.string().optional(),
});

// ── Permit ────────────────────────────────────────────────────

export const applyPermitSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  // permitType: z.string().min(2, 'Permit type is required'),
  categoryId: z.string(),
  validFrom: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }).optional(),
});

export const renewPermitSchema = z.object({
  validFrom: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid start date' }),
});

// ── Invoice ───────────────────────────────────────────────────

export const listInvoicesSchema = z.object({
  page: z.string().optional().transform((v) => parseInt(v || '1')),
  limit: z.string().optional().transform((v) => parseInt(v || '10')),
  status: z
    .enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid'])
    .optional(),
});

export const verifyPermitSchema = z.object({
  // intentionally empty — code comes from URL param
});