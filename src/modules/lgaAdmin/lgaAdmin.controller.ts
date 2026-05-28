// src/modules/lgaAdmin/lgaAdmin.controller.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { Role } from '@prisma/client';
import { getIp, queryString } from '../complaints/complaints.controller';

// ─────────────────────────────────────────────────────────────
// WARD MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/lga-admin/wards
 * Create a new ward.
 */
export const createWard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.id;
    const { name, code, description } = req.body;

    const existing = await prisma.ward.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) {
      return sendError(res, 'A ward with this name or code already exists', 'CONFLICT', null, 409);
    }

    const ward = await prisma.ward.create({
      data: { name, code, description },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_created',
        entity: 'Ward',
        entityId: ward.id,
        userId: adminId,
        details: { name, code },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, ward, 'Ward created successfully', 201);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/lga-admin/wards
 * List all wards with councillor info and stats.
 */
export const listWards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page  = parseInt(queryString(req.query.page)  ?? '1');
    const limit = parseInt(queryString(req.query.limit) ?? '20');
    const skip  = (page - 1) * limit;

    const [wards, total] = await Promise.all([
      prisma.ward.findMany({
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
      prisma.ward.count({ where: { deletedAt: null } }),
    ]);

    return sendSuccess(res, {
      data: wards,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/lga-admin/wards/:id
 * Get single ward with full detail.
 */
export const getWardById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    

    const ward = await prisma.ward.findUnique({
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

    if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, ward);
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/lga-admin/wards/:id
 * Update ward details.
 */
export const updateWard = async (req: Request, res: Response, next: NextFunction) => {
  try {
        let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;

    const ward = await prisma.ward.findUnique({ where: { id } });
    if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);

    const updated = await prisma.ward.update({
      where: { id },
      data: req.body,
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_updated',
        entity: 'Ward',
        entityId: id,
        userId: adminId,
        details: req.body,
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, updated, 'Ward updated');
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/lga-admin/wards/:id/assign-councillor
 * Assign a ward councillor to a ward.
 * Councillor must already exist as a user with role = ward_councillor.
 */
export const assignCouncillor = async (req: Request, res: Response, next: NextFunction) => {
  try {
        let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;
    const { councillorId } = req.body;

    const [ward, councillor] = await Promise.all([
      prisma.ward.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: councillorId } }),
    ]);

    if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);
    if (!councillor) return sendError(res, 'Councillor user not found', 'NOT_FOUND', null, 404);

    if (councillor.role !== 'ward_councillor') {
      return sendError(
        res,
        'User must have the ward_councillor role to be assigned to a ward',
        'BAD_REQUEST',
        null,
        400
      );
    }

    // Unassign councillor from any previous ward then assign to new one
    await prisma.user.update({
      where: { id: councillorId },
      data: { wardId: id },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_updated',
        entity: 'Ward',
        entityId: id,
        userId: adminId,
        details: { councillorId, action: 'assigned_councillor' },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, { wardId: id, councillorId }, 'Councillor assigned to ward');
  } catch (err) { next(err); }
};

/**
 * DELETE /api/v1/lga-admin/wards/:id
 * Soft delete a ward.
 */
export const deleteWard = async (req: Request, res: Response, next: NextFunction) => {
  try {
        let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;

    const ward = await prisma.ward.findUnique({ where: { id } });
    if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);

    await prisma.ward.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_deleted',
        entity: 'Ward',
        entityId: id,
        userId: adminId,
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, null, 'Ward deactivated');
  } catch (err) { next(err); }
};

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
export const createStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.id;
    const { email, firstName, lastName, phone, role, wardId, contractorId } = req.body;

    // LGA Admin cannot create super_admin, chairman, treasurer, auditor
    const allowedRoles: Role[] = ['ward_councillor', 'contractor', 'field_officer', 'agent'];
    if (!allowedRoles.includes(role as Role)) {
      return sendError(
        res,
        'LGA Admin can only create ward_councillor, contractor, field_officer, or agent accounts',
        'FORBIDDEN',
        null,
        403
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return sendError(res, 'Email already registered', 'CONFLICT', null, 409);

    // Validate ward exists if provided
    if (wardId) {
      const ward = await prisma.ward.findUnique({ where: { id: wardId } });
      if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);
    }

    // Validate contractor exists if assigning a field officer or agent
    if (contractorId) {
      const contractor = await prisma.user.findUnique({
        where: { id: contractorId },
        select: { role: true },
      });
      if (!contractor || contractor.role !== 'contractor') {
        return sendError(res, 'Contractor not found or invalid', 'NOT_FOUND', null, 404);
      }
    }

    // Generate a secure temporary password
    const tempPassword = crypto.randomBytes(6).toString('hex'); // e.g. "a1b2c3d4e5f6"
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const staff = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        phone,
        password: hashedPassword,
        role: role as Role,
        ...(wardId       && { wardId }),
        ...(contractorId && { contractorId }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, wardId: true, contractorId: true,
        isActive: true, createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_created',
        entity: 'User',
        entityId: staff.id,
        userId: adminId,
        details: { role, email, wardId, contractorId },
        ipAddress: getIp(req),
      },
    });

    // TODO Phase 7: Send tempPassword to staff via email/SMS

    return sendSuccess(
      res,
      {
        staff,
        temporaryPassword: tempPassword, // returned once — store it securely
        notice: 'Share this temporary password with the staff member. They should change it on first login.',
      },
      'Staff account created successfully',
      201
    );
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/lga-admin/staff
 * List all staff with role and ward filters.
 */
export const listStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role     = queryString(req.query.role) as Role | undefined;
    const wardId   = queryString(req.query.wardId);
    const isActive = req.query.isActive !== undefined
      ? req.query.isActive === 'true'
      : undefined;
    const page  = parseInt(queryString(req.query.page)  ?? '1');
    const limit = parseInt(queryString(req.query.limit) ?? '10');
    const skip  = (page - 1) * limit;

    // Exclude super_admin, lga_admin, citizen, business_owner from staff list
    const staffRoles: Role[] = ['ward_councillor', 'contractor', 'field_officer', 'agent', 'chairman', 'treasurer', 'auditor'];

    const where: any = {
      role: { in: role ? [role] : staffRoles },
      deletedAt: null,
      ...(wardId   !== undefined && { wardId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [staff, total] = await Promise.all([
      prisma.user.findMany({
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
      prisma.user.count({ where }),
    ]);

    return sendSuccess(res, {
      data: staff,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/lga-admin/staff/:id
 * Get a single staff member with full profile.
 */
export const getStaffById = async (req: Request, res: Response, next: NextFunction) => {
  try {
        let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const staff = await prisma.user.findUnique({
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

    if (!staff) return sendError(res, 'Staff member not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, staff);
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/lga-admin/staff/:id
 * Update staff profile or reassign ward/contractor.
 */
export const updateStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
        let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;
    const { firstName, lastName, phone, isActive, wardId, contractorId } = req.body;

    const staff = await prisma.user.findUnique({ where: { id } });
    if (!staff) return sendError(res, 'Staff member not found', 'NOT_FOUND', null, 404);

    // LGA Admin cannot modify super_admin or lga_admin accounts
    if (['super_admin', 'lga_admin'].includes(staff.role)) {
      return sendError(res, 'You cannot modify this account', 'FORBIDDEN', null, 403);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName    !== undefined && { firstName }),
        ...(lastName     !== undefined && { lastName }),
        ...(phone        !== undefined && { phone }),
        ...(isActive     !== undefined && { isActive }),
        ...(wardId       !== undefined && { wardId }),
        ...(contractorId !== undefined && { contractorId }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, isActive: true, wardId: true, contractorId: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_updated',
        entity: 'User',
        entityId: id,
        userId: adminId,
        details: req.body,
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, updated, 'Staff updated');
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/lga-admin/staff/:id/toggle-status
 * Activate or suspend a staff account.
 */
export const toggleStaffStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
        let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;

    const staff = await prisma.user.findUnique({ where: { id } });
    if (!staff) return sendError(res, 'Staff member not found', 'NOT_FOUND', null, 404);

    if (['super_admin', 'lga_admin'].includes(staff.role)) {
      return sendError(res, 'You cannot suspend this account', 'FORBIDDEN', null, 403);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !staff.isActive },
      select: { id: true, email: true, isActive: true, role: true },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_updated',
        entity: 'User',
        entityId: id,
        userId: adminId,
        details: { action: updated.isActive ? 'activated' : 'suspended' },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(
      res,
      updated,
      `Account ${updated.isActive ? 'activated' : 'suspended'} successfully`
    );
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// LGA ADMIN OVERVIEW DASHBOARD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/lga-admin/overview
 * High-level stats for the LGA Admin dashboard.
 * No financial data — that belongs to Treasurer.
 */
export const getAdminOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalWards,
      totalStaff,
      totalBusinesses,
      applicationStats,
      complaintStats,
    ] = await Promise.all([
      prisma.ward.count({ where: { deletedAt: null } }),

      prisma.user.count({
        where: {
          role: { in: ['ward_councillor', 'contractor', 'field_officer', 'agent'] },
          deletedAt: null,
        },
      }),

      prisma.business.count({ where: { isActive: true } }),

      // Application breakdown by status
      prisma.stateOfOriginApplication.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      // Complaint breakdown by status
      prisma.complaint.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const applications = applicationStats.reduce((acc: Record<string, number>, s) => {
      acc[s.status] = s._count._all;
      return acc;
    }, {});

    const complaints = complaintStats.reduce((acc: Record<string, number>, s) => {
      acc[s.status] = s._count._all;
      return acc;
    }, {});

    return sendSuccess(res, {
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
  } catch (err) { next(err); }
};