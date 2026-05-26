// src/modules/complaints/complaints.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { generateReceiptNumber } from '../../utils/generators';
import { ComplaintStatus } from '@prisma/client';

// src/utils/request.ts

export const getIp = (req: Request): string | null => req.ip ?? null;

// src/utils/request.ts  (add to the same file)
export const queryString = (val: unknown): string | undefined => {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val[0] as string;
  return undefined;
};

// ─────────────────────────────────────────────────────────────
// CITIZEN & BUSINESS OWNER — Raise & Track
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/complaints
 * Citizen or business owner raises a complaint.
 */
export const raiseComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { title, description, wardId } = req.body;

    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);

    const complaint = await prisma.complaint.create({
      data: {
        ticketNumber: generateReceiptNumber('TKT'),
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

    await prisma.auditLog.create({
      data: {
        action: 'complaint_raised',
        entity: 'Complaint',
        entityId: complaint.id,
        userId,
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, complaint, 'Complaint raised successfully', 201);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/complaints/my
 * Citizen or business owner views their own complaints.
 */
export const getMyComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const status = queryString(req.query.status) as ComplaintStatus | undefined;
    const page  = parseInt(queryString(req.query.page)  ?? '1');
    const limit = parseInt(queryString(req.query.limit) ?? '10');
    const skip  = (page - 1) * limit;

    const where = {
      raisedById: userId,
      ...(status && { status }),
    };

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
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
      prisma.complaint.count({ where }),
    ]);

    return sendSuccess(res, {
      data: complaints,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/complaints/my/:id
 * Citizen views a single complaint — ownership enforced.
 */
export const getMyComplaintById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const complaint = await prisma.complaint.findFirst({
      where: { id, raisedById: userId }, // ownership check at query level
      include: {
        ward: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        responses: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!complaint) return sendError(res, 'Complaint not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, complaint);
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// WARD COUNCILLOR — Own Ward Only
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/complaints/ward
 * Ward Councillor views complaints from their assigned ward only.
 */
export const getWardComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const councillorId = req.user!.id;
    const status = queryString(req.query.status) as ComplaintStatus | undefined;
    const page  = parseInt(queryString(req.query.page)  ?? '1');
    const limit = parseInt(queryString(req.query.limit) ?? '10');
    const skip  = (page - 1) * limit;

    const councillor = await prisma.user.findUnique({
      where: { id: councillorId },
      select: { wardId: true },
    });

    if (!councillor?.wardId) {
      return sendError(res, 'No ward assigned to your account', 'BAD_REQUEST', null, 400);
    }

    const where = {
      wardId: councillor.wardId,
      ...(status && { status }),
    };

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
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
      prisma.complaint.count({ where }),
    ]);

    return sendSuccess(res, {
      data: complaints,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/complaints/ward/:id/respond
 * Ward Councillor responds to a complaint in their ward.
 */
export const wardCouncillorRespond = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const councillorId = req.user!.id;
    const { message } = req.body;

    const councillor = await prisma.user.findUnique({
      where: { id: councillorId },
      select: { wardId: true },
    });

    const complaint = await prisma.complaint.findUnique({ where: { id } });

    if (!complaint) return sendError(res, 'Complaint not found', 'NOT_FOUND', null, 404);

    // Enforce ward scope
    if (complaint.wardId !== councillor?.wardId) {
      return sendError(res, 'This complaint does not belong to your ward', 'FORBIDDEN', null, 403);
    }

    const response = await prisma.complaintResponse.create({
      data: { complaintId: id, message, responderId: councillorId },
    });

    // Auto-move to in_progress if still open or assigned
    if (['open', 'assigned'].includes(complaint.status)) {
      await prisma.complaint.update({
        where: { id },
        data: { status: 'in_progress' },
      });
    }

    return sendSuccess(res, response, 'Response submitted');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// LGA ADMIN — Full Complaint Management
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/complaints/admin
 * LGA Admin views all complaints across all wards with filters.
 */
export const getAllComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = queryString(req.query.status) as ComplaintStatus | undefined;
    const wardId = queryString(req.query.wardId);
    const page   = parseInt(queryString(req.query.page)  ?? '1');
    const limit  = parseInt(queryString(req.query.limit) ?? '10');
    const skip   = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (wardId) where.wardId = wardId;

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
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
      prisma.complaint.count({ where }),
    ]);

    return sendSuccess(res, {
      data: complaints,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/complaints/admin/:id
 * LGA Admin views a single complaint in full detail.
 */
export const getComplaintById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        ward: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, role: true } },
        responses: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!complaint) return sendError(res, 'Complaint not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, complaint);
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/complaints/admin/:id/assign
 * LGA Admin assigns a complaint to an officer or councillor.
 */
export const assignComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { assignedToId } = req.body;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return sendError(res, 'Complaint not found', 'NOT_FOUND', null, 404);

    if (['resolved', 'closed'].includes(complaint.status)) {
      return sendError(res, 'Cannot reassign a resolved or closed complaint', 'BAD_REQUEST', null, 400);
    }

    // Verify the assignee exists and has a valid role
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    if (!assignee) return sendError(res, 'Assignee not found or inactive', 'NOT_FOUND', null, 404);

    const allowedAssigneeRoles = ['ward_councillor', 'field_officer', 'lga_admin'];
    if (!allowedAssigneeRoles.includes(assignee.role)) {
      return sendError(res, 'This user cannot be assigned complaints', 'BAD_REQUEST', null, 400);
    }

    const updated = await prisma.complaint.update({
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

    await prisma.auditLog.create({
      data: {
        action: 'complaint_assigned',
        entity: 'Complaint',
        entityId: id,
        userId: adminId,
        details: { assignedToId, assigneeName: `${assignee.firstName} ${assignee.lastName}` },
        ipAddress: getIp(req),
      },
    });

    // TODO: Notify assignee via notification system

    return sendSuccess(res, updated, `Complaint assigned to ${assignee.firstName} ${assignee.lastName}`);
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/complaints/admin/:id/status
 * LGA Admin updates complaint status.
 */
export const updateComplaintStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { status, resolutionNote } = req.body;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return sendError(res, 'Complaint not found', 'NOT_FOUND', null, 404);

    if (complaint.status === 'closed') {
      return sendError(res, 'Closed complaints cannot be updated', 'BAD_REQUEST', null, 400);
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        status,
        ...(resolutionNote && { resolutionNote }),
        ...(status === 'resolved' && { resolvedAt: new Date() }),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'complaint_resolved',
        entity: 'Complaint',
        entityId: id,
        userId: adminId,
        details: { status, resolutionNote },
        ipAddress: getIp(req),
      },
    });

    // TODO: Notify the complainant of the status update

    return sendSuccess(res, updated, `Complaint status updated to ${status}`);
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/complaints/admin/:id/respond
 * LGA Admin adds a response to any complaint.
 */
export const adminRespond = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { message } = req.body;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return sendError(res, 'Complaint not found', 'NOT_FOUND', null, 404);

    if (complaint.status === 'closed') {
      return sendError(res, 'Cannot respond to a closed complaint', 'BAD_REQUEST', null, 400);
    }

    const response = await prisma.complaintResponse.create({
      data: { complaintId: id, message, responderId: adminId },
    });

    if (complaint.status === 'open') {
      await prisma.complaint.update({
        where: { id },
        data: { status: 'in_progress' },
      });
    }

    return sendSuccess(res, response, 'Response added');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// STATS — LGA Admin / Chairman dashboard widget
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/complaints/stats
 * Returns complaint counts grouped by status.
 * Accessible by lga_admin, chairman, super_admin.
 */
export const getComplaintStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await prisma.complaint.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const formatted = stats.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});

    const total = Object.values(formatted).reduce((sum, count) => sum + count, 0);

    return sendSuccess(res, { total, breakdown: formatted });
  } catch (err) { next(err); }
};