import { z } from 'zod';
import { RevenueCategory, PaymentMethod } from '@prisma/client';

export const fieldRegisterBusinessSchema = z.object({
  businessName: z.string().min(2, 'Valid business name required'),
  ownerName: z.string().min(2, 'Valid owner name required'),
  address: z.string().min(5, 'Physical address description required'),
  phone: z.string().min(10, 'Valid contact phone number required'),
  email: z.string().email().optional().or(z.literal('')),
  cacNumber: z.string().optional().or(z.literal('')),
  category: z.string().min(2, 'Industry type designation required'),
  wardId: z.string().uuid('Invalid ward reference mapping'),
  ownerId: z.string().uuid('Valid system owner account ID required')
});

export const fieldCreateInvoiceSchema = z.object({
  businessId: z.string().uuid('Valid business ID required'),
  category: z.enum([
    'trade_permit', 'market_levy', 'environmental_levy', 'signage', 
    'parking_levy', 'haulage_levy', 'lockup_store_levy', 'business_levy', 
    'event_permit', 'state_of_origin_fee', 'other'
  ] as const),
  description: z.string().optional(),
  levyConfigId: z.string().uuid('Valid target LevyConfig reference required'),
  dueDate: z.string().datetime('Due date must be a valid ISO timestamp')
});

export const fieldRecordPaymentSchema = z.object({
  invoiceId: z.string().uuid('Valid invoice target reference required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  method: z.enum(['cash', 'pos'] as const), // Restricted field-supported parameters
  reference: z.string().min(3, 'Manual transaction or POS reference receipt ID required'),
  narration: z.string().optional()
});