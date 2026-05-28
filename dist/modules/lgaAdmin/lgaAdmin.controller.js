"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminOverview = exports.toggleStaffStatus = exports.updateStaff = exports.getStaffById = exports.listStaff = exports.createStaff = exports.deleteWard = exports.assignCouncillor = exports.updateWard = exports.getWardById = exports.listWards = exports.createWard = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../../utils/prisma");
const response_1 = require("../../utils/response");
const complaints_controller_1 = require("../complaints/complaints.controller");
// ─────────────────────────────────────────────────────────────
// WARD MANAGEMENT
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/lga-admin/wards
 * Create a new ward.
 */
const createWard = async (req, res, next) => {
    try {
        const adminId = req.user.id;
        const { name, code, description } = req.body;
        const existing = await prisma_1.prisma.ward.findFirst({
            where: { OR: [{ name }, { code }] },
        });
        if (existing) {
            return (0, response_1.sendError)(res, 'A ward with this name or code already exists', 'CONFLICT', null, 409);
        }
        const ward = await prisma_1.prisma.ward.create({
            data: { name, code, description },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'user_created',
                entity: 'Ward',
                entityId: ward.id,
                userId: adminId,
                details: { name, code },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, ward, 'Ward created successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createWard = createWard;
/**
 * GET /api/v1/lga-admin/wards
 * List all wards with councillor info and stats.
 */
const listWards = async (req, res, next) => {
    try {
        const page = parseInt((0, complaints_controller_1.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, complaints_controller_1.queryString)(req.query.limit) ?? '20');
        const skip = (page - 1) * limit;
        const [wards, total] = await Promise.all([
            prisma_1.prisma.ward.findMany({
                skip,
                take: limit,
                where: { deletedAt: null },
                include: {
                    councillors: {
                        select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
                    },
                    _count: {
                        select: {
                            complaints: true,
                            stateOfOriginApplications: true,
                            businesses: true,
                        },
                    },
                },
                orderBy: { name: 'asc' },
            }),
            prisma_1.prisma.ward.count({ where: { deletedAt: null } }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            data: wards,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.listWards = listWards;
/**
 * GET /api/v1/lga-admin/wards/:id
 * Get single ward with full detail.
 */
const getWardById = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const ward = await prisma_1.prisma.ward.findUnique({
            where: { id },
            include: {
                councillors: {
                    select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true },
                },
                _count: {
                    select: {
                        complaints: true,
                        stateOfOriginApplications: true,
                        businesses: true,
                    },
                },
            },
        });
        if (!ward)
            return (0, response_1.sendError)(res, 'Ward not found', 'NOT_FOUND', null, 404);
        return (0, response_1.sendSuccess)(res, ward);
    }
    catch (err) {
        next(err);
    }
};
exports.getWardById = getWardById;
/**
 * PATCH /api/v1/lga-admin/wards/:id
 * Update ward details.
 */
const updateWard = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const adminId = req.user.id;
        const ward = await prisma_1.prisma.ward.findUnique({ where: { id } });
        if (!ward)
            return (0, response_1.sendError)(res, 'Ward not found', 'NOT_FOUND', null, 404);
        const updated = await prisma_1.prisma.ward.update({
            where: { id },
            data: req.body,
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'user_updated',
                entity: 'Ward',
                entityId: id,
                userId: adminId,
                details: req.body,
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, updated, 'Ward updated');
    }
    catch (err) {
        next(err);
    }
};
exports.updateWard = updateWard;
/**
 * PATCH /api/v1/lga-admin/wards/:id/assign-councillor
 * Assign a ward councillor to a ward.
 * Councillor must already exist as a user with role = ward_councillor.
 */
const assignCouncillor = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const adminId = req.user.id;
        const { councillorId } = req.body;
        const [ward, councillor] = await Promise.all([
            prisma_1.prisma.ward.findUnique({ where: { id } }),
            prisma_1.prisma.user.findUnique({ where: { id: councillorId } }),
        ]);
        if (!ward)
            return (0, response_1.sendError)(res, 'Ward not found', 'NOT_FOUND', null, 404);
        if (!councillor)
            return (0, response_1.sendError)(res, 'Councillor user not found', 'NOT_FOUND', null, 404);
        if (councillor.role !== 'ward_councillor') {
            return (0, response_1.sendError)(res, 'User must have the ward_councillor role to be assigned to a ward', 'BAD_REQUEST', null, 400);
        }
        // Unassign councillor from any previous ward then assign to new one
        await prisma_1.prisma.user.update({
            where: { id: councillorId },
            data: { wardId: id },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'user_updated',
                entity: 'Ward',
                entityId: id,
                userId: adminId,
                details: { councillorId, action: 'assigned_councillor' },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, { wardId: id, councillorId }, 'Councillor assigned to ward');
    }
    catch (err) {
        next(err);
    }
};
exports.assignCouncillor = assignCouncillor;
/**
 * DELETE /api/v1/lga-admin/wards/:id
 * Soft delete a ward.
 */
const deleteWard = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const adminId = req.user.id;
        const ward = await prisma_1.prisma.ward.findUnique({ where: { id } });
        if (!ward)
            return (0, response_1.sendError)(res, 'Ward not found', 'NOT_FOUND', null, 404);
        await prisma_1.prisma.ward.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'user_deleted',
                entity: 'Ward',
                entityId: id,
                userId: adminId,
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, null, 'Ward deactivated');
    }
    catch (err) {
        next(err);
    }
};
exports.deleteWard = deleteWard;
// ─────────────────────────────────────────────────────────────
// STAFF MANAGEMENT
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/lga-admin/staff
 * LGA Admin creates a new staff account.
 * Roles allowed: ward_councillor, contractor, field_officer, agent.
 * A secure temporary password is generated and should be
 * sent to the user via email/SMS (TODO Phase 7).
 */
const createStaff = async (req, res, next) => {
    try {
        const adminId = req.user.id;
        const { email, firstName, lastName, phone, role, wardId, contractorId } = req.body;
        // LGA Admin cannot create super_admin, chairman, treasurer, auditor
        const allowedRoles = ['ward_councillor', 'contractor', 'field_officer', 'agent'];
        if (!allowedRoles.includes(role)) {
            return (0, response_1.sendError)(res, 'LGA Admin can only create ward_councillor, contractor, field_officer, or agent accounts', 'FORBIDDEN', null, 403);
        }
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing)
            return (0, response_1.sendError)(res, 'Email already registered', 'CONFLICT', null, 409);
        // Validate ward exists if provided
        if (wardId) {
            const ward = await prisma_1.prisma.ward.findUnique({ where: { id: wardId } });
            if (!ward)
                return (0, response_1.sendError)(res, 'Ward not found', 'NOT_FOUND', null, 404);
        }
        // Validate contractor exists if assigning a field officer or agent
        if (contractorId) {
            const contractor = await prisma_1.prisma.user.findUnique({
                where: { id: contractorId },
                select: { role: true },
            });
            if (!contractor || contractor.role !== 'contractor') {
                return (0, response_1.sendError)(res, 'Contractor not found or invalid', 'NOT_FOUND', null, 404);
            }
        }
        // Generate a secure temporary password
        const tempPassword = crypto_1.default.randomBytes(6).toString('hex'); // e.g. "a1b2c3d4e5f6"
        const hashedPassword = await bcryptjs_1.default.hash(tempPassword, 12);
        const staff = await prisma_1.prisma.user.create({
            data: {
                email,
                firstName,
                lastName,
                phone,
                password: hashedPassword,
                role: role,
                ...(wardId && { wardId }),
                ...(contractorId && { contractorId }),
            },
            select: {
                id: true, email: true, firstName: true, lastName: true,
                role: true, phone: true, wardId: true, contractorId: true,
                isActive: true, createdAt: true,
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'user_created',
                entity: 'User',
                entityId: staff.id,
                userId: adminId,
                details: { role, email, wardId, contractorId },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        // TODO Phase 7: Send tempPassword to staff via email/SMS
        return (0, response_1.sendSuccess)(res, {
            staff,
            temporaryPassword: tempPassword, // returned once — store it securely
            notice: 'Share this temporary password with the staff member. They should change it on first login.',
        }, 'Staff account created successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createStaff = createStaff;
/**
 * GET /api/v1/lga-admin/staff
 * List all staff with role and ward filters.
 */
const listStaff = async (req, res, next) => {
    try {
        const role = (0, complaints_controller_1.queryString)(req.query.role);
        const wardId = (0, complaints_controller_1.queryString)(req.query.wardId);
        const isActive = req.query.isActive !== undefined
            ? req.query.isActive === 'true'
            : undefined;
        const page = parseInt((0, complaints_controller_1.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, complaints_controller_1.queryString)(req.query.limit) ?? '10');
        const skip = (page - 1) * limit;
        // Exclude super_admin, lga_admin, citizen, business_owner from staff list
        const staffRoles = ['ward_councillor', 'contractor', 'field_officer', 'agent', 'chairman', 'treasurer', 'auditor'];
        const where = {
            role: { in: role ? [role] : staffRoles },
            deletedAt: null,
            ...(wardId !== undefined && { wardId }),
            ...(isActive !== undefined && { isActive }),
        };
        const [staff, total] = await Promise.all([
            prisma_1.prisma.user.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true, email: true, firstName: true, lastName: true,
                    role: true, phone: true, isActive: true,
                    wardId: true,
                    ward: { select: { id: true, name: true } },
                    contractorId: true,
                    contractor: { select: { id: true, firstName: true, lastName: true } },
                    createdAt: true, lastLoginAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.user.count({ where }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            data: staff,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.listStaff = listStaff;
/**
 * GET /api/v1/lga-admin/staff/:id
 * Get a single staff member with full profile.
 */
const getStaffById = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const staff = await prisma_1.prisma.user.findUnique({
            where: { id },
            select: {
                id: true, email: true, firstName: true, lastName: true,
                role: true, phone: true, isActive: true, address: true,
                wardId: true,
                ward: { select: { id: true, name: true, code: true } },
                contractorId: true,
                contractor: { select: { id: true, firstName: true, lastName: true, email: true } },
                fieldOfficers: {
                    select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
                },
                createdAt: true, lastLoginAt: true,
            },
        });
        if (!staff)
            return (0, response_1.sendError)(res, 'Staff member not found', 'NOT_FOUND', null, 404);
        return (0, response_1.sendSuccess)(res, staff);
    }
    catch (err) {
        next(err);
    }
};
exports.getStaffById = getStaffById;
/**
 * PATCH /api/v1/lga-admin/staff/:id
 * Update staff profile or reassign ward/contractor.
 */
const updateStaff = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const adminId = req.user.id;
        const { firstName, lastName, phone, isActive, wardId, contractorId } = req.body;
        const staff = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!staff)
            return (0, response_1.sendError)(res, 'Staff member not found', 'NOT_FOUND', null, 404);
        // LGA Admin cannot modify super_admin or lga_admin accounts
        if (['super_admin', 'lga_admin'].includes(staff.role)) {
            return (0, response_1.sendError)(res, 'You cannot modify this account', 'FORBIDDEN', null, 403);
        }
        const updated = await prisma_1.prisma.user.update({
            where: { id },
            data: {
                ...(firstName !== undefined && { firstName }),
                ...(lastName !== undefined && { lastName }),
                ...(phone !== undefined && { phone }),
                ...(isActive !== undefined && { isActive }),
                ...(wardId !== undefined && { wardId }),
                ...(contractorId !== undefined && { contractorId }),
            },
            select: {
                id: true, email: true, firstName: true, lastName: true,
                role: true, phone: true, isActive: true, wardId: true, contractorId: true,
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'user_updated',
                entity: 'User',
                entityId: id,
                userId: adminId,
                details: req.body,
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, updated, 'Staff updated');
    }
    catch (err) {
        next(err);
    }
};
exports.updateStaff = updateStaff;
/**
 * PATCH /api/v1/lga-admin/staff/:id/toggle-status
 * Activate or suspend a staff account.
 */
const toggleStaffStatus = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const adminId = req.user.id;
        const staff = await prisma_1.prisma.user.findUnique({ where: { id } });
        if (!staff)
            return (0, response_1.sendError)(res, 'Staff member not found', 'NOT_FOUND', null, 404);
        if (['super_admin', 'lga_admin'].includes(staff.role)) {
            return (0, response_1.sendError)(res, 'You cannot suspend this account', 'FORBIDDEN', null, 403);
        }
        const updated = await prisma_1.prisma.user.update({
            where: { id },
            data: { isActive: !staff.isActive },
            select: { id: true, email: true, isActive: true, role: true },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'user_updated',
                entity: 'User',
                entityId: id,
                userId: adminId,
                details: { action: updated.isActive ? 'activated' : 'suspended' },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, updated, `Account ${updated.isActive ? 'activated' : 'suspended'} successfully`);
    }
    catch (err) {
        next(err);
    }
};
exports.toggleStaffStatus = toggleStaffStatus;
// ─────────────────────────────────────────────────────────────
// LGA ADMIN OVERVIEW DASHBOARD
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/lga-admin/overview
 * High-level stats for the LGA Admin dashboard.
 * No financial data — that belongs to Treasurer.
 */
const getAdminOverview = async (req, res, next) => {
    try {
        const [totalWards, totalStaff, totalBusinesses, applicationStats, complaintStats,] = await Promise.all([
            prisma_1.prisma.ward.count({ where: { deletedAt: null } }),
            prisma_1.prisma.user.count({
                where: {
                    role: { in: ['ward_councillor', 'contractor', 'field_officer', 'agent'] },
                    deletedAt: null,
                },
            }),
            prisma_1.prisma.business.count({ where: { isActive: true } }),
            // Application breakdown by status
            prisma_1.prisma.stateOfOriginApplication.groupBy({
                by: ['status'],
                _count: { _all: true },
            }),
            // Complaint breakdown by status
            prisma_1.prisma.complaint.groupBy({
                by: ['status'],
                _count: { _all: true },
            }),
        ]);
        const applications = applicationStats.reduce((acc, s) => {
            acc[s.status] = s._count._all;
            return acc;
        }, {});
        const complaints = complaintStats.reduce((acc, s) => {
            acc[s.status] = s._count._all;
            return acc;
        }, {});
        return (0, response_1.sendSuccess)(res, {
            wards: totalWards,
            staff: totalStaff,
            businesses: totalBusinesses,
            applications: {
                total: Object.values(applications).reduce((s, c) => s + c, 0),
                breakdown: applications,
            },
            complaints: {
                total: Object.values(complaints).reduce((s, c) => s + c, 0),
                breakdown: complaints,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getAdminOverview = getAdminOverview;
