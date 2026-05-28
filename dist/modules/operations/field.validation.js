"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectionsQuerySchema = exports.issuePermitSchema = exports.recordPaymentSchema = exports.generateInvoiceSchema = exports.registerBusinessSchema = void 0;
// src/modules/fieldOfficer/fieldOfficer.validation.ts
const zod_1 = require("zod");
// ── Business Registration ─────────────────────────────────────
exports.registerBusinessSchema = zod_1.z.object({
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
// ── Invoice Generation ────────────────────────────────────────
exports.generateInvoiceSchema = zod_1.z.object({
    businessId: zod_1.z.string().uuid('Invalid business ID'),
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
        'state_of_origin_fee',
        'other',
    ]),
    description: zod_1.z.string().optional(),
    // Officer can override amount if no levy config exists
    // Treasurer config takes precedence if present
    overrideAmount: zod_1.z.number().positive().optional(),
    quantity: zod_1.z.number().int().positive().default(1),
});
// ── Payment Recording ─────────────────────────────────────────
exports.recordPaymentSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().uuid('Invalid invoice ID'),
    amount: zod_1.z.number().positive('Amount must be positive'),
    method: zod_1.z.enum(['cash', 'pos', 'bank_transfer', 'virtual_account', 'online_gateway']),
    reference: zod_1.z.string().optional(), // POS slip, transfer ref etc.
    narration: zod_1.z.string().optional(),
});
// ── Permit Issuance ───────────────────────────────────────────
exports.issuePermitSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().uuid('Invoice ID is required'),
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
    businessId: zod_1.z.string().uuid('Invalid business ID'),
    validFrom: zod_1.z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }).optional(),
});
// ── Query Filters ─────────────────────────────────────────────
exports.collectionsQuerySchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform((v) => parseInt(v || '1')),
    limit: zod_1.z.string().optional().transform((v) => parseInt(v || '10')),
    date: zod_1.z.string().optional(), // filter by specific date YYYY-MM-DD
    category: zod_1.z.enum([
        'trade_permit', 'market_levy', 'environmental_levy',
        'signage', 'parking_levy', 'haulage_levy',
        'lockup_store_levy', 'business_levy', 'event_permit',
        'state_of_origin_fee', 'other',
    ]).optional(),
});
