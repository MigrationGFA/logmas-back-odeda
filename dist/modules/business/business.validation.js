"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPermitSchema = exports.listInvoicesSchema = exports.renewPermitSchema = exports.applyPermitSchema = exports.updateBusinessSchema = exports.createBusinessSchema = void 0;
// src/modules/business/business.validation.ts
const zod_1 = require("zod");
exports.createBusinessSchema = zod_1.z.object({
    businessName: zod_1.z.string().min(2, 'Business name is required'),
    ownerName: zod_1.z.string().min(2, 'Owner name is required'),
    address: zod_1.z.string().min(5, 'Business address is required'),
    phone: zod_1.z.string().min(10, 'Valid phone number is required'),
    email: zod_1.z.string().email().optional(),
    cacNumber: zod_1.z.string().optional(),
    category: zod_1.z.string().min(2, 'Business category is required'),
    description: zod_1.z.string().optional(),
    wardId: zod_1.z.string().uuid('Invalid ward ID'),
});
exports.updateBusinessSchema = zod_1.z.object({
    businessName: zod_1.z.string().min(2).optional(),
    ownerName: zod_1.z.string().min(2).optional(),
    address: zod_1.z.string().min(5).optional(),
    phone: zod_1.z.string().min(10).optional(),
    email: zod_1.z.string().email().optional(),
    cacNumber: zod_1.z.string().optional(),
    category: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().optional(),
});
// ── Permit ────────────────────────────────────────────────────
exports.applyPermitSchema = zod_1.z.object({
    businessId: zod_1.z.string().uuid('Invalid business ID'),
    permitType: zod_1.z.string().min(2, 'Permit type is required'),
    category: zod_1.z.enum([
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
    validFrom: zod_1.z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }).optional(),
});
exports.renewPermitSchema = zod_1.z.object({
    validFrom: zod_1.z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid start date' }),
});
// ── Invoice ───────────────────────────────────────────────────
exports.listInvoicesSchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform((v) => parseInt(v || '1')),
    limit: zod_1.z.string().optional().transform((v) => parseInt(v || '10')),
    status: zod_1.z
        .enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid'])
        .optional(),
});
exports.verifyPermitSchema = zod_1.z.object({
// intentionally empty — code comes from URL param
});
