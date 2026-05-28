"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWardsSchema = exports.listStaffSchema = exports.updateStaffSchema = exports.createStaffSchema = exports.assignCouncillorSchema = exports.updateWardSchema = exports.createWardSchema = void 0;
// src/modules/lgaAdmin/lgaAdmin.validation.ts
const zod_1 = require("zod");
// ── Ward Management ───────────────────────────────────────────
exports.createWardSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Ward name is required'),
    code: zod_1.z.string().min(2, 'Ward code is required'),
    description: zod_1.z.string().optional(),
});
exports.updateWardSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    code: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().optional(),
});
exports.assignCouncillorSchema = zod_1.z.object({
    councillorId: zod_1.z.string().uuid('Invalid councillor user ID'),
});
// ── Staff Creation ────────────────────────────────────────────
exports.createStaffSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email is required'),
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    phone: zod_1.z.string().min(10).optional(),
    role: zod_1.z.enum(['ward_councillor', 'contractor', 'field_officer', 'agent']),
    wardId: zod_1.z.string().uuid().optional(), // required when role = ward_councillor
    contractorId: zod_1.z.string().uuid().optional(), // required when role = field_officer or agent
}).refine((data) => {
    if (data.role === 'ward_councillor' && !data.wardId)
        return false;
    return true;
}, { message: 'wardId is required when creating a ward councillor' })
    .refine((data) => {
    if ((data.role === 'field_officer' || data.role === 'agent') && !data.contractorId)
        return false;
    return true;
}, { message: 'contractorId is required when creating a field officer or agent' });
exports.updateStaffSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).optional(),
    lastName: zod_1.z.string().min(1).optional(),
    phone: zod_1.z.string().min(10).optional(),
    isActive: zod_1.z.boolean().optional(),
    wardId: zod_1.z.string().uuid().optional(),
    contractorId: zod_1.z.string().uuid().optional(),
});
// ── Query Filters ─────────────────────────────────────────────
exports.listStaffSchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform((v) => parseInt(v || '1')),
    limit: zod_1.z.string().optional().transform((v) => parseInt(v || '10')),
    role: zod_1.z.enum([
        'ward_councillor', 'contractor', 'field_officer',
        'agent', 'lga_admin', 'chairman', 'treasurer', 'auditor',
    ]).optional(),
    isActive: zod_1.z.string().optional().transform((v) => v === 'true'),
    wardId: zod_1.z.string().uuid().optional(),
});
exports.listWardsSchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform((v) => parseInt(v || '1')),
    limit: zod_1.z.string().optional().transform((v) => parseInt(v || '10')),
});
