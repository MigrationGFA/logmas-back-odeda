"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listApplicationsSchema = exports.councillorDecisionSchema = exports.reviewApplicationSchema = exports.submitApplicationSchema = void 0;
// src/modules/stateOfOrigin/stateOfOrigin.validation.ts
const zod_1 = require("zod");
exports.submitApplicationSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, 'Full name is required'),
    dateOfBirth: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid date of birth',
    }),
    gender: zod_1.z.enum(['male', 'female', 'other']),
    address: zod_1.z.string().min(5, 'Address is required'),
    phone: zod_1.z.string().min(10, 'Valid phone number is required'),
    email: zod_1.z.string().email().optional(),
    wardId: zod_1.z.string().uuid('Invalid ward ID'),
    purpose: zod_1.z.string().min(3).optional(),
    nin: zod_1.z.string().optional(),
    passportUrl: zod_1.z.string().url().optional(),
});
exports.reviewApplicationSchema = zod_1.z.object({
    reviewNotes: zod_1.z.string().optional(),
});
exports.councillorDecisionSchema = zod_1.z.object({
    decision: zod_1.z.enum(['approved', 'rejected']),
    councillorNotes: zod_1.z.string().optional(),
    rejectionReason: zod_1.z.string().optional(),
}).refine((data) => {
    if (data.decision === 'rejected' && !data.rejectionReason) {
        return false;
    }
    return true;
}, { message: 'Rejection reason is required when rejecting an application' });
exports.listApplicationsSchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform(v => parseInt(v || '1')),
    limit: zod_1.z.string().optional().transform(v => parseInt(v || '10')),
    status: zod_1.z.enum([
        'draft', 'submitted', 'payment_pending', 'paid',
        'under_review', 'forwarded_to_councillor',
        'approved', 'rejected', 'certificate_issued'
    ]).optional(),
    wardId: zod_1.z.string().uuid().optional(),
});
