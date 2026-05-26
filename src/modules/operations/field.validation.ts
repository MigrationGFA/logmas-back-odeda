// src/modules/fieldOfficer/fieldOfficer.validation.ts
import { z } from 'zod';

// ── Business Registration ─────────────────────────────────────

export const registerBusinessSchema = z.object({
  businessName: z.string().min(2, 'Business name is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  address: z.string().min(5, 'Business address is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email().optional(),
  cacNumber: z.string().optional(),
  category: z.string().min(2, 'Business category is required'),
  description: z.string().optional(),
  wardId: z.string().uuid('Invalid ward ID'),
});

// ── Invoice Generation ────────────────────────────────────────

export const generateInvoiceSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  category: z.enum([
    'trade_permit',
    'market_levy',
    'environmental_levy',
    'signage',
    'parking_levy',
    'haulage_levy',
    'lockup_store_levy',
    'business_levy',
    'event_permit',
    'state_of_origin_fee',
    'other',
  ]),
  description: z.string().optional(),
  // Officer can override amount if no levy config exists
  // Treasurer config takes precedence if present
  overrideAmount: z.number().positive().optional(),
  quantity: z.number().int().positive().default(1),
});

// ── Payment Recording ─────────────────────────────────────────

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['cash', 'pos', 'bank_transfer', 'virtual_account', 'online_gateway']),
  reference: z.string().optional(), // POS slip, transfer ref etc.
  narration: z.string().optional(),
});

// ── Permit Issuance ───────────────────────────────────────────

export const issuePermitSchema = z.object({
  invoiceId: z.string().uuid('Invoice ID is required'),
  permitType: z.string().min(2, 'Permit type is required'),
  category: z.enum([
    'trade_permit',
    'market_levy',
    'environmental_levy',
    'signage',
    'parking_levy',
    'haulage_levy',
    'lockup_store_levy',
    'business_levy',
    'event_permit',
    'other',
  ]),
  businessId: z.string().uuid('Invalid business ID'),
  validFrom: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }).optional(),
});

// ── Query Filters ─────────────────────────────────────────────

export const collectionsQuerySchema = z.object({
  page: z.string().optional().transform((v) => parseInt(v || '1')),
  limit: z.string().optional().transform((v) => parseInt(v || '10')),
  date: z.string().optional(), // filter by specific date YYYY-MM-DD
  category: z.enum([
    'trade_permit', 'market_levy', 'environmental_levy',
    'signage', 'parking_levy', 'haulage_levy',
    'lockup_store_levy', 'business_levy', 'event_permit',
    'state_of_origin_fee', 'other',
  ]).optional(),
});