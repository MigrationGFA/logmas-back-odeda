"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listComplaintsSchema = exports.updateComplaintStatusSchema = exports.respondToComplaintSchema = exports.assignComplaintSchema = exports.raiseComplaintSchema = void 0;
// src/modules/complaints/complaints.validation.ts
const zod_1 = require("zod");
exports.raiseComplaintSchema = zod_1.z.object({
    title: zod_1.z.string().min(5, 'Title must be at least 5 characters'),
    description: zod_1.z.string().min(20, 'Please provide more detail in your description'),
    wardId: zod_1.z.string().uuid('Invalid ward ID'),
});
exports.assignComplaintSchema = zod_1.z.object({
    assignedToId: zod_1.z.string().uuid('Invalid officer ID'),
});
exports.respondToComplaintSchema = zod_1.z.object({
    message: zod_1.z.string().min(5, 'Response message is required'),
});
exports.updateComplaintStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['assigned', 'in_progress', 'resolved', 'closed']),
    resolutionNote: zod_1.z.string().optional(),
}).refine((data) => {
    if (data.status === 'resolved' && !data.resolutionNote)
        return false;
    return true;
}, { message: 'Resolution note is required when marking as resolved' });
exports.listComplaintsSchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform(v => parseInt(v || '1')),
    limit: zod_1.z.string().optional().transform(v => parseInt(v || '10')),
    status: zod_1.z.enum(['open', 'assigned', 'in_progress', 'resolved', 'closed']).optional(),
    wardId: zod_1.z.string().uuid().optional(),
});
