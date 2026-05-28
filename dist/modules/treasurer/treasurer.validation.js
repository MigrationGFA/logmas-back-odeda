"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceFilterSchema = exports.dateRangeSchema = exports.listLevyConfigsSchema = exports.updateLevyConfigSchema = exports.createLevyConfigSchema = void 0;
// src/modules/treasurer/treasurer.validation.ts
const zod_1 = require("zod");
// ── Levy Config ───────────────────────────────────────────────
exports.createLevyConfigSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Config name is required'),
    category: zod_1.z.enum([
        'trade_permit', 'market_levy', 'environmental_levy', 'signage',
        'parking_levy', 'haulage_levy', 'lockup_store_levy', 'business_levy',
        'event_permit', 'state_of_origin_fee', 'other',
    ]),
    description: zod_1.z.string().optional(),
    amount: zod_1.z.number().positive('Amount must be positive'),
    billingCycle: zod_1.z.enum(['one_time', 'daily', 'weekly', 'monthly', 'yearly']).default('yearly'),
    penaltyRate: zod_1.z.number().min(0).max(100).optional(), // percentage
    effectiveFrom: zod_1.z.string().refine((v) => !isNaN(Date.parse(v)), {
        message: 'Invalid effectiveFrom date',
    }).optional(),
    effectiveTo: zod_1.z.string().refine((v) => !isNaN(Date.parse(v)), {
        message: 'Invalid effectiveTo date',
    }).optional(),
});
exports.updateLevyConfigSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().optional(),
    amount: zod_1.z.number().positive().optional(),
    billingCycle: zod_1.z.enum(['one_time', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
    penaltyRate: zod_1.z.number().min(0).max(100).optional(),
    effectiveTo: zod_1.z.string().refine((v) => !isNaN(Date.parse(v)), {
        message: 'Invalid effectiveTo date',
    }).optional(),
});
exports.listLevyConfigsSchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform((v) => parseInt(v || '1')),
    limit: zod_1.z.string().optional().transform((v) => parseInt(v || '10')),
    category: zod_1.z.enum([
        'trade_permit', 'market_levy', 'environmental_levy', 'signage',
        'parking_levy', 'haulage_levy', 'lockup_store_levy', 'business_levy',
        'event_permit', 'state_of_origin_fee', 'other',
    ]).optional(),
    isActive: zod_1.z.string().optional().transform((v) => v === 'true'),
});
// ── Revenue & Reporting ───────────────────────────────────────
exports.dateRangeSchema = zod_1.z.object({
    from: zod_1.z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid from date' }).optional(),
    to: zod_1.z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid to date' }).optional(),
    page: zod_1.z.string().optional().transform((v) => parseInt(v || '1')),
    limit: zod_1.z.string().optional().transform((v) => parseInt(v || '10')),
});
exports.invoiceFilterSchema = zod_1.z.object({
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    status: zod_1.z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid']).optional(),
    category: zod_1.z.enum([
        'trade_permit', 'market_levy', 'environmental_levy', 'signage',
        'parking_levy', 'haulage_levy', 'lockup_store_levy', 'business_levy',
        'event_permit', 'state_of_origin_fee', 'other',
    ]).optional(),
    officerId: zod_1.z.string().uuid().optional(),
    businessId: zod_1.z.string().uuid().optional(),
    page: zod_1.z.string().optional().transform((v) => parseInt(v || '1')),
    limit: zod_1.z.string().optional().transform((v) => parseInt(v || '10')),
});
