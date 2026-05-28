// src/modules/treasurer/treasurer.validation.ts
import { z } from 'zod';

// ── Levy Config ───────────────────────────────────────────────

export const createLevyConfigSchema = z.object({
  name: z.string().min(2, 'Config name is required'),
  category: z.enum([
    'trade_permit', 'market_levy', 'environmental_levy', 'signage',
    'parking_levy', 'haulage_levy', 'lockup_store_levy', 'business_levy',
    'event_permit', 'state_of_origin_fee', 'other',
  ]),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  billingCycle: z.enum(['one_time', 'daily', 'weekly', 'monthly', 'yearly']).default('yearly'),
  penaltyRate: z.number().min(0).max(100).optional(), // percentage
  effectiveFrom: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'Invalid effectiveFrom date',
  }).optional(),
  effectiveTo: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'Invalid effectiveTo date',
  }).optional(),
});

export const updateLevyConfigSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  amount: z.number().positive().optional(),
  billingCycle: z.enum(['one_time', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
  penaltyRate: z.number().min(0).max(100).optional(),
  effectiveTo: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'Invalid effectiveTo date',
  }).optional(),
});

export const listLevyConfigsSchema = z.object({
  page: z.string().optional().transform((v) => parseInt(v || '1')),
  limit: z.string().optional().transform((v) => parseInt(v || '10')),
  category: z.enum([
    'trade_permit', 'market_levy', 'environmental_levy', 'signage',
    'parking_levy', 'haulage_levy', 'lockup_store_levy', 'business_levy',
    'event_permit', 'state_of_origin_fee', 'other',
  ]).optional(),
  isActive: z.string().optional().transform((v) => v === 'true'),
});

// ── Revenue & Reporting ───────────────────────────────────────

export const dateRangeSchema = z.object({
  from: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid from date' }).optional(),
  to: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid to date' }).optional(),
  page: z.string().optional().transform((v) => parseInt(v || '1')),
  limit: z.string().optional().transform((v) => parseInt(v || '10')),
});

export const invoiceFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid']).optional(),
  category: z.enum([
    'trade_permit', 'market_levy', 'environmental_levy', 'signage',
    'parking_levy', 'haulage_levy', 'lockup_store_levy', 'business_levy',
    'event_permit', 'state_of_origin_fee', 'other',
  ]).optional(),
  officerId: z.string().uuid().optional(),
  businessId: z.string().uuid().optional(),
  page: z.string().optional().transform((v) => parseInt(v || '1')),
  limit: z.string().optional().transform((v) => parseInt(v || '10')),
});