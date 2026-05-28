"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getComplaintStats = exports.adminRespond = exports.updateComplaintStatus = exports.assignComplaint = exports.getComplaintById = exports.getAllComplaints = exports.wardCouncillorRespond = exports.getWardComplaints = exports.getMyComplaintById = exports.getMyComplaints = exports.raiseComplaint = exports.queryString = exports.getIp = void 0;
const prisma_1 = require("../../utils/prisma");
const response_1 = require("../../utils/response");
const generators_1 = require("../../utils/generators");
// src/utils/request.ts
const getIp = (req) => req.ip ?? null;
exports.getIp = getIp;
// src/utils/request.ts  (add to the same file)
const queryString = (val) => {
    if (typeof val === 'string')
        return val;
    if (Array.isArray(val))
        return val[0];
    return undefined;
};
exports.queryString = queryString;
// ─────────────────────────────────────────────────────────────
// CITIZEN & BUSINESS OWNER — Raise & Track
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/complaints
 * Citizen or business owner raises a complaint.
 */
const raiseComplaint = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { title, description, wardId } = req.body;
        const ward = await prisma_1.prisma.ward.findUnique({ where: { id: wardId } });
        if (!ward)
            return (0, response_1.sendError)(res, 'Ward not found', 'NOT_FOUND', null, 404);
        const complaint = await prisma_1.prisma.complaint.create({
            data: {
                ticketNumber: (0, generators_1.generateReceiptNumber)('TKT'),
                title,
                description,
                wardId,
                raisedById: userId,
                status: 'open',
            },
            include: {
                ward: { select: { id: true, name: true } },
                raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'complaint_raised',
                entity: 'Complaint',
                entityId: complaint.id,
                userId,
                ipAddress: (0, exports.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, complaint, 'Complaint raised successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.raiseComplaint = raiseComplaint;
/**
 * GET /api/v1/complaints/my
 * Citizen or business owner views their own complaints.
 */
const getMyComplaints = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const status = (0, exports.queryString)(req.query.status);
        const page = parseInt((0, exports.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, exports.queryString)(req.query.limit) ?? '10');
        const skip = (page - 1) * limit;
        const where = {
            raisedById: userId,
            ...(status && { status }),
        };
        const [complaints, total] = await Promise.all([
            prisma_1.prisma.complaint.findMany({
                where,
                skip,
                take: limit,
                include: {
                    ward: { select: { id: true, name: true } },
                    assignedTo: { select: { id: true, firstName: true, lastName: true } },
                    responses: {
                        orderBy: { createdAt: 'asc' },
                        select: { id: true, message: true, responderId: true, createdAt: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.complaint.count({ where }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            data: complaints,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getMyComplaints = getMyComplaints;
/**
 * GET /api/v1/complaints/my/:id
 * Citizen views a single complaint — ownership enforced.
 */
const getMyComplaintById = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const userId = req.user.id;
        const complaint = await prisma_1.prisma.complaint.findFirst({
            where: { id, raisedById: userId }, // ownership check at query level
            include: {
                ward: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, firstName: true, lastName: true } },
                responses: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!complaint)
            return (0, response_1.sendError)(res, 'Complaint not found', 'NOT_FOUND', null, 404);
        return (0, response_1.sendSuccess)(res, complaint);
    }
    catch (err) {
        next(err);
    }
};
exports.getMyComplaintById = getMyComplaintById;
// ─────────────────────────────────────────────────────────────
// WARD COUNCILLOR — Own Ward Only
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/complaints/ward
 * Ward Councillor views complaints from their assigned ward only.
 */
const getWardComplaints = async (req, res, next) => {
    try {
        const councillorId = req.user.id;
        const status = (0, exports.queryString)(req.query.status);
        const page = parseInt((0, exports.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, exports.queryString)(req.query.limit) ?? '10');
        const skip = (page - 1) * limit;
        const councillor = await prisma_1.prisma.user.findUnique({
            where: { id: councillorId },
            select: { wardId: true },
        });
        if (!councillor?.wardId) {
            return (0, response_1.sendError)(res, 'No ward assigned to your account', 'BAD_REQUEST', null, 400);
        }
        const where = {
            wardId: councillor.wardId,
            ...(status && { status }),
        };
        const [complaints, total] = await Promise.all([
            prisma_1.prisma.complaint.findMany({
                where,
                skip,
                take: limit,
                include: {
                    raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                    assignedTo: { select: { id: true, firstName: true, lastName: true } },
                    responses: { orderBy: { createdAt: 'asc' } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.complaint.count({ where }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            data: complaints,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getWardComplaints = getWardComplaints;
/**
 * POST /api/v1/complaints/ward/:id/respond
 * Ward Councillor responds to a complaint in their ward.
 */
const wardCouncillorRespond = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const councillorId = req.user.id;
        const { message } = req.body;
        const councillor = await prisma_1.prisma.user.findUnique({
            where: { id: councillorId },
            select: { wardId: true },
        });
        const complaint = await prisma_1.prisma.complaint.findUnique({ where: { id } });
        if (!complaint)
            return (0, response_1.sendError)(res, 'Complaint not found', 'NOT_FOUND', null, 404);
        // Enforce ward scope
        if (complaint.wardId !== councillor?.wardId) {
            return (0, response_1.sendError)(res, 'This complaint does not belong to your ward', 'FORBIDDEN', null, 403);
        }
        const response = await prisma_1.prisma.complaintResponse.create({
            data: { complaintId: id, message, responderId: councillorId },
        });
        // Auto-move to in_progress if still open or assigned
        if (['open', 'assigned'].includes(complaint.status)) {
            await prisma_1.prisma.complaint.update({
                where: { id },
                data: { status: 'in_progress' },
            });
        }
        return (0, response_1.sendSuccess)(res, response, 'Response submitted');
    }
    catch (err) {
        next(err);
    }
};
exports.wardCouncillorRespond = wardCouncillorRespond;
// ─────────────────────────────────────────────────────────────
// LGA ADMIN — Full Complaint Management
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/complaints/admin
 * LGA Admin views all complaints across all wards with filters.
 */
const getAllComplaints = async (req, res, next) => {
    try {
        const status = (0, exports.queryString)(req.query.status);
        const wardId = (0, exports.queryString)(req.query.wardId);
        const page = parseInt((0, exports.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, exports.queryString)(req.query.limit) ?? '10');
        const skip = (page - 1) * limit;
        const where = {};
        if (status)
            where.status = status;
        if (wardId)
            where.wardId = wardId;
        const [complaints, total] = await Promise.all([
            prisma_1.prisma.complaint.findMany({
                where,
                skip,
                take: limit,
                include: {
                    raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                    ward: { select: { id: true, name: true, code: true } },
                    assignedTo: { select: { id: true, firstName: true, lastName: true, role: true } },
                    responses: { orderBy: { createdAt: 'asc' } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.complaint.count({ where }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            data: complaints,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getAllComplaints = getAllComplaints;
/**
 * GET /api/v1/complaints/admin/:id
 * LGA Admin views a single complaint in full detail.
 */
const getComplaintById = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const complaint = await prisma_1.prisma.complaint.findUnique({
            where: { id },
            include: {
                raisedBy: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
                ward: true,
                assignedTo: { select: { id: true, firstName: true, lastName: true, role: true } },
                responses: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!complaint)
            return (0, response_1.sendError)(res, 'Complaint not found', 'NOT_FOUND', null, 404);
        return (0, response_1.sendSuccess)(res, complaint);
    }
    catch (err) {
        next(err);
    }
};
exports.getComplaintById = getComplaintById;
/**
 * PATCH /api/v1/complaints/admin/:id/assign
 * LGA Admin assigns a complaint to an officer or councillor.
 */
const assignComplaint = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const adminId = req.user.id;
        const { assignedToId } = req.body;
        const complaint = await prisma_1.prisma.complaint.findUnique({ where: { id } });
        if (!complaint)
            return (0, response_1.sendError)(res, 'Complaint not found', 'NOT_FOUND', null, 404);
        if (['resolved', 'closed'].includes(complaint.status)) {
            return (0, response_1.sendError)(res, 'Cannot reassign a resolved or closed complaint', 'BAD_REQUEST', null, 400);
        }
        // Verify the assignee exists and has a valid role
        const assignee = await prisma_1.prisma.user.findUnique({
            where: { id: assignedToId, isActive: true },
            select: { id: true, firstName: true, lastName: true, role: true },
        });
        if (!assignee)
            return (0, response_1.sendError)(res, 'Assignee not found or inactive', 'NOT_FOUND', null, 404);
        const allowedAssigneeRoles = ['ward_councillor', 'field_officer', 'lga_admin'];
        if (!allowedAssigneeRoles.includes(assignee.role)) {
            return (0, response_1.sendError)(res, 'This user cannot be assigned complaints', 'BAD_REQUEST', null, 400);
        }
        const updated = await prisma_1.prisma.complaint.update({
            where: { id },
            data: {
                assignedToId,
                assignedAt: new Date(),
                status: 'assigned',
            },
            include: {
                assignedTo: { select: { id: true, firstName: true, lastName: true, role: true } },
                ward: { select: { id: true, name: true } },
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'complaint_assigned',
                entity: 'Complaint',
                entityId: id,
                userId: adminId,
                details: { assignedToId, assigneeName: `${assignee.firstName} ${assignee.lastName}` },
                ipAddress: (0, exports.getIp)(req),
            },
        });
        // TODO: Notify assignee via notification system
        return (0, response_1.sendSuccess)(res, updated, `Complaint assigned to ${assignee.firstName} ${assignee.lastName}`);
    }
    catch (err) {
        next(err);
    }
};
exports.assignComplaint = assignComplaint;
/**
 * PATCH /api/v1/complaints/admin/:id/status
 * LGA Admin updates complaint status.
 */
const updateComplaintStatus = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const adminId = req.user.id;
        const { status, resolutionNote } = req.body;
        const complaint = await prisma_1.prisma.complaint.findUnique({ where: { id } });
        if (!complaint)
            return (0, response_1.sendError)(res, 'Complaint not found', 'NOT_FOUND', null, 404);
        if (complaint.status === 'closed') {
            return (0, response_1.sendError)(res, 'Closed complaints cannot be updated', 'BAD_REQUEST', null, 400);
        }
        const updated = await prisma_1.prisma.complaint.update({
            where: { id },
            data: {
                status,
                ...(resolutionNote && { resolutionNote }),
                ...(status === 'resolved' && { resolvedAt: new Date() }),
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'complaint_resolved',
                entity: 'Complaint',
                entityId: id,
                userId: adminId,
                details: { status, resolutionNote },
                ipAddress: (0, exports.getIp)(req),
            },
        });
        // TODO: Notify the complainant of the status update
        return (0, response_1.sendSuccess)(res, updated, `Complaint status updated to ${status}`);
    }
    catch (err) {
        next(err);
    }
};
exports.updateComplaintStatus = updateComplaintStatus;
/**
 * POST /api/v1/complaints/admin/:id/respond
 * LGA Admin adds a response to any complaint.
 */
const adminRespond = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const adminId = req.user.id;
        const { message } = req.body;
        const complaint = await prisma_1.prisma.complaint.findUnique({ where: { id } });
        if (!complaint)
            return (0, response_1.sendError)(res, 'Complaint not found', 'NOT_FOUND', null, 404);
        if (complaint.status === 'closed') {
            return (0, response_1.sendError)(res, 'Cannot respond to a closed complaint', 'BAD_REQUEST', null, 400);
        }
        const response = await prisma_1.prisma.complaintResponse.create({
            data: { complaintId: id, message, responderId: adminId },
        });
        if (complaint.status === 'open') {
            await prisma_1.prisma.complaint.update({
                where: { id },
                data: { status: 'in_progress' },
            });
        }
        return (0, response_1.sendSuccess)(res, response, 'Response added');
    }
    catch (err) {
        next(err);
    }
};
exports.adminRespond = adminRespond;
// ─────────────────────────────────────────────────────────────
// STATS — LGA Admin / Chairman dashboard widget
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/complaints/stats
 * Returns complaint counts grouped by status.
 * Accessible by lga_admin, chairman, super_admin.
 */
const getComplaintStats = async (req, res, next) => {
    try {
        const stats = await prisma_1.prisma.complaint.groupBy({
            by: ['status'],
            _count: { _all: true },
        });
        const formatted = stats.reduce((acc, item) => {
            acc[item.status] = item._count._all;
            return acc;
        }, {});
        const total = Object.values(formatted).reduce((sum, count) => sum + count, 0);
        return (0, response_1.sendSuccess)(res, { total, breakdown: formatted });
    }
    catch (err) {
        next(err);
    }
};
exports.getComplaintStats = getComplaintStats;
