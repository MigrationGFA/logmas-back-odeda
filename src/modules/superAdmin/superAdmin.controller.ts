// src/modules/superAdmin/superAdmin.controller.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { Role } from '@prisma/client';
import { getIp, queryString } from '../complaints/complaints.controller';

const buildDateRange = (from?: string, to?: string) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    gte: from ? new Date(from) : startOfMonth,
    lte: to   ? new Date(to)   : now,
  };
};

// ─────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/super-admin/users
 * Create any user of any role including principal officers.
 */
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.id;
    const { email, firstName, lastName, phone, role, wardId, contractorId } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return sendError(res, 'Email already registered', 'CONFLICT', null, 409);

    if (wardId) {
      const ward = await prisma.ward.findUnique({ where: { id: wardId } });
      if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);
    }

    if (contractorId) {
      const contractor = await prisma.user.findUnique({
        where: { id: contractorId },
        select: { role: true },
      });
      if (!contractor || contractor.role !== 'contractor') {
        return sendError(res, 'Contractor not found or invalid', 'NOT_FOUND', null, 404);
      }
    }

    const tempPassword   = crypto.randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        email, firstName, lastName, phone,
        password: hashedPassword,
        role: role as Role,
        ...(wardId       && { wardId }),
        ...(contractorId && { contractorId }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, isActive: true,
        wardId: true, contractorId: true, createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_created',
        entity: 'User',
        entityId: user.id,
        userId: adminId,
        details: { role, email },
        ipAddress: getIp(req),
      },
    });

    // TODO Phase 7: send tempPassword via email/SMS

    return sendSuccess(res, {
      user,
      temporaryPassword: tempPassword,
      notice: 'Share this temporary password with the user. They should change it on first login.',
    }, 'User created successfully', 201);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/super-admin/users
 * All users system-wide — filterable by role, active status, search term.
 */
export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role     = queryString(req.query.role)   as Role | undefined;
    const search   = queryString(req.query.search);
    const isActive = req.query.isActive !== undefined
      ? req.query.isActive === 'true'
      : undefined;
    const page  = parseInt(queryString(req.query.page)  ?? '1');
    const limit = parseInt(queryString(req.query.limit) ?? '20');
    const skip  = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (role)     where.role     = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
        { phone:     { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, phone: true, isActive: true,
          wardId: true,
          ward:   { select: { id: true, name: true } },
          contractorId: true,
          contractor:   { select: { id: true, firstName: true, lastName: true } },
          lastLoginAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return sendSuccess(res, {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/super-admin/users/:id
 * Full profile of any user.
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: String(id) },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, address: true, nin: true,
        isActive: true, avatarUrl: true,
        wardId: true,
        ward:   { select: { id: true, name: true, code: true } },
        contractorId: true,
        contractor:   { select: { id: true, firstName: true, lastName: true } },
        // fieldOfficers:{ select: { id: true, firstName: true, lastName: true, role: true, isActive: true } },
        agents:       { select: { id: true, firstName: true, lastName: true, isActive: true } },
        lastLoginAt: true, createdAt: true, updatedAt: true,
        _count: {
          select: {
            invoicesCreated:   true,
            receiptsIssued:    true,
            permitsIssued:     true,
            complaintsRaised:  true,
            auditLogs:         true,
          },
        },
      },
    });

    if (!user) return sendError(res, 'User not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, user);
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/super-admin/users/:id
 * Update any user — role, ward, contractor, active status.
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id }  = req.params;
    const adminId = req.user!.id;

    // Prevent super_admin from editing themselves via this endpoint
    if (id === adminId) {
      return sendError(res, 'Use your profile settings to update your own account', 'BAD_REQUEST', null, 400);
    }

    const user = await prisma.user.findUnique({ where: { id: String(id) } });
    if (!user) return sendError(res, 'User not found', 'NOT_FOUND', null, 404);

    const { firstName, lastName, phone, role, wardId, contractorId, isActive } = req.body;

    const updated = await prisma.user.update({
      where: { id: String(id) },
      data: {
        ...(firstName    !== undefined && { firstName }),
        ...(lastName     !== undefined && { lastName }),
        ...(phone        !== undefined && { phone }),
        ...(role         !== undefined && { role: role as Role }),
        ...(wardId       !== undefined && { wardId }),
        ...(contractorId !== undefined && { contractorId }),
        ...(isActive     !== undefined && { isActive }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, isActive: true,
        wardId: true, contractorId: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_updated',
        entity: 'User',
        entityId: String(id),
        userId: adminId,
        details: {
          before: { role: user.role, isActive: user.isActive },
          after:  { role: updated.role, isActive: updated.isActive },
        },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, updated, 'User updated');
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/super-admin/users/:id/toggle-status
 * Activate or suspend any account.
 */
export const toggleUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id }  = req.params;
    const adminId = req.user!.id;

    if (id === adminId) {
      return sendError(res, 'You cannot suspend your own account', 'BAD_REQUEST', null, 400);
    }

    const user = await prisma.user.findUnique({ where: { id: String(id) } });
    if (!user) return sendError(res, 'User not found', 'NOT_FOUND', null, 404);

    const updated = await prisma.user.update({
      where: { id: String(id) },
      data:  { isActive: !user.isActive },
      select: { id: true, email: true, role: true, isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_updated',
        entity: 'User',
        entityId: String(id),
        userId: adminId,
        details: { action: updated.isActive ? 'activated' : 'suspended' },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, updated, `Account ${updated.isActive ? 'activated' : 'suspended'}`);
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/super-admin/users/:id/reset-password
 * Generate a new temporary password for any user.
 */
export const resetUserPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id }  = req.params;
    const adminId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: String(id) } });
    if (!user) return sendError(res, 'User not found', 'NOT_FOUND', null, 404);

    const tempPassword   = crypto.randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: String(id) },
      data:  { password: hashedPassword },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_updated',
        entity: 'User',
        entityId: String(id),
        userId: adminId,
        details: { action: 'password_reset' },
        ipAddress: getIp(req),
      },
    });

    // TODO Phase 7: Send tempPassword to user via email/SMS

    return sendSuccess(res, {
      temporaryPassword: tempPassword,
      notice: 'Share this with the user. They should change it immediately after login.',
    }, 'Password reset successfully');
  } catch (err) { next(err); }
};

/**
 * DELETE /api/v1/super-admin/users/:id
 * Soft delete any user account.
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id }  = req.params;
    const adminId = req.user!.id;

    if (id === adminId) {
      return sendError(res, 'You cannot delete your own account', 'BAD_REQUEST', null, 400);
    }

    const user = await prisma.user.findUnique({ where: { id: String(id) } });
    if (!user) return sendError(res, 'User not found', 'NOT_FOUND', null, 404);

    await prisma.user.update({
      where: { id: String(id) },
      data:  { deletedAt: new Date(), isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_deleted',
        entity: 'User',
        entityId: String(id),
        userId: adminId,
        details: { email: user.email, role: user.role },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, null, 'User account deactivated');
  } catch (err) { next(err); }
};

/**
 * DELETE /api/v1/lga-admin/accounts/:id
 * Soft delete — super_admin only.
 */
export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id }  = req.params;
    const { id: requesterId } = req.user!;
 
    if (id === requesterId) {
      return sendError(res, 'You cannot delete your own account', 'BAD_REQUEST', null, 400);
    }
 
    const target = await prisma.user.findUnique({
      where: { id:String(id) },
      select: { id: true, email: true, role: true, deletedAt: true },
    });
 
    if (!target || target.deletedAt) {
      return sendError(res, 'Account not found', 'NOT_FOUND', null, 404);
    }
 
    await prisma.user.update({
      where: { id:String(id) },
      data: { deletedAt: new Date(), isActive: false },
    });
 
    await prisma.auditLog.create({
      data: {
        action:   'user_deleted',
        entity:   'User',
        entityId: String(id),
        userId:   requesterId,
        details:  { email: target.email, role: target.role },
        ipAddress: getIp(req),
      },
    });
 
    return sendSuccess(res, null, 'Account deleted successfully');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GLOBAL ANALYTICS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/super-admin/analytics
 * System-wide KPIs — the full picture.
 */
export const getGlobalAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = queryString(req.query.from);
    const to   = queryString(req.query.to);
    const dateRange = buildDateRange(from, to);

    const [
      usersByRole,
      revenueSummary,
      revenueByCategory,
      applicationStats,
      complaintStats,
      permitStats,
      totalBusinesses,
      recentAuditLogs,
    ] = await Promise.all([
      // Users by role
      prisma.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),

      // Revenue totals for period
      prisma.invoice.aggregate({
        where: { createdAt: dateRange },
        _sum: { totalAmount: true, amountPaid: true, balanceDue: true },
        _count: { _all: true },
      }),

      // Revenue by category
      prisma.invoice.groupBy({
        by: ['categoryId'],
        where: { createdAt: dateRange },
        _sum: { amountPaid: true },
        _count: { _all: true },
        orderBy: { _sum: { amountPaid: 'desc' } },
      }),

      // Application stats
      prisma.stateOfOriginApplication.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      // Complaint stats
      prisma.complaint.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      // Permit stats
      prisma.permit.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      prisma.business.count({ where: { isActive: true } }),

      // Last 10 audit log entries
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      }),
    ]);

    const collectionRate = revenueSummary._sum.totalAmount
      ? ((Number(revenueSummary._sum.amountPaid) / Number(revenueSummary._sum.totalAmount)) * 100).toFixed(2)
      : '0.00';

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },
      users: {
        total: usersByRole.reduce((s, r) => s + r._count._all, 0),
        byRole: usersByRole.reduce((acc: Record<string, number>, r) => {
          acc[r.role] = r._count._all; return acc;
        }, {}),
      },
      revenue: {
        totalInvoiced:    revenueSummary._sum.totalAmount  ?? 0,
        totalCollected:   revenueSummary._sum.amountPaid   ?? 0,
        totalOutstanding: revenueSummary._sum.balanceDue   ?? 0,
        totalInvoices:    revenueSummary._count._all,
        collectionRate:   `${collectionRate}%`,
        byCategory: revenueByCategory.map((c) => ({
          category:    c.categoryId,
          collected:   c._sum.amountPaid ?? 0,
          transactions: c._count._all,
        })),
      },
      operations: {
        totalBusinesses,
        applications: applicationStats.reduce((acc: Record<string, number>, s) => {
          acc[s.status] = s._count._all; return acc;
        }, {}),
        complaints: complaintStats.reduce((acc: Record<string, number>, s) => {
          acc[s.status] = s._count._all; return acc;
        }, {}),
        permits: permitStats.reduce((acc: Record<string, number>, s) => {
          acc[s.status] = s._count._all; return acc;
        }, {}),
      },
      recentActivity: recentAuditLogs,
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/super-admin/audit-logs
 * Full system audit log with all filters — same as Auditor but super_admin scoped.
 */
export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = queryString(req.query.userId);
    const entity = queryString(req.query.entity);
    const from   = queryString(req.query.from);
    const to     = queryString(req.query.to);
    const page   = parseInt(queryString(req.query.page)  ?? '1');
    const limit  = parseInt(queryString(req.query.limit) ?? '20');
    const skip   = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (entity) where.entity = entity;
    if (from || to) where.createdAt = buildDateRange(from, to);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return sendSuccess(res, {
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};