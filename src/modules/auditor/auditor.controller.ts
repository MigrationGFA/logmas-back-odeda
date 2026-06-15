// src/modules/auditor/auditor.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { AuditAction, PaymentMethod, PaymentStatus } from '@prisma/client';
import { queryString } from '../complaints/complaints.controller';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const buildDateRange = (from?: string, to?: string) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    gte: from ? new Date(from) : startOfMonth,
    lte: to   ? new Date(to)   : now,
  };
};

// ─────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auditor/audit-logs
 * Full audit log — filterable by action, user, entity, date range.
 */
export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const action = queryString(req.query.action) as AuditAction | undefined;
    const userId = queryString(req.query.userId);
    const entity = queryString(req.query.entity);
    const search = queryString(req.query.search); // for UI search box
    const from   = queryString(req.query.from);
    const to     = queryString(req.query.to);
    const page   = parseInt(queryString(req.query.page)  ?? '1');
    const limit  = parseInt(queryString(req.query.limit) ?? '50');
    const skip   = (page - 1) * limit;

    const where: any = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (entity) where.entity = entity;
    if (from || to) where.createdAt = buildDateRange(from, to);

    // Search across action, entity, entityId
    if (search) {
      where.OR = [
        { action:   { contains: search, mode: 'insensitive' } },
        { entity:   { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName:  { contains: search, mode: 'insensitive' } } },
        { user: { email:     { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [logs, total, actionCounts] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true, firstName: true,
              lastName: true, email: true, role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      prisma.auditLog.count({ where }),

      // Stat card counts — always unfiltered for accurate totals
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { _all: true },
      }),
    ]);

    // Build stat counts from groupBy
    const countMap = actionCounts.reduce((acc: Record<string, number>, r) => {
      acc[r.action] = r._count._all;
      return acc;
    }, {});

    const paymentEvents = (countMap['payment_confirmed'] ?? 0) +
                          (countMap['payment_reversed']  ?? 0);
    const permitEvents  = (countMap['permit_issued']     ?? 0) +
                          (countMap['permit_revoked']    ?? 0);
    const suspicious    = (countMap['payment_reversed']  ?? 0) +
                          (countMap['login_failed']      ?? 0);

    // Shape each log to match UI field names exactly
    const shaped = logs.map((log) => ({
      id:        log.id,
      createdAt: log.createdAt.toISOString(),

      // UI reads actor as a display name string
      actor: log.user
        ? `${log.user.firstName} ${log.user.lastName}`
        : 'System',

      // UI reads actorRole as a badge
      actorRole: log.user?.role ?? 'system',

      // UI reads action as a badge — keep uppercase for visual consistency
      action: log.action.toUpperCase(),

      // UI reads target — use entityId (invoice number, user email etc)
      // Fall back to entity type if no ID
      target: log.entityId ?? log.entity ?? '—',

      // UI reads meta as JSON.stringify'd object
      meta: log.details ?? null,

      // Extra fields available if UI needs them later
      entity:    log.entity,
      entityId:  log.entityId,
      ipAddress: log.ipAddress,
      email:     log.user?.email ?? null,
    }));

    return sendSuccess(res, {
      // Stat cards
      stats: {
        total:         total,
        paymentEvents,
        permitEvents,
        suspicious,
      },
      // Table rows
      data: shaped,
      
    }, {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/auditor/audit-logs/:id
 * Single audit log entry with full detail.
 */
export const getAuditLogById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const log = await prisma.auditLog.findUnique({
      where: { id: String(id) },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
      },
    });

    if (!log) return sendError(res, 'Audit log entry not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, log);
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auditor/payments
 * All payments — filterable by method, status, date range.
 */
export const getAllPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const method = queryString(req.query.method) as PaymentMethod | undefined;
    const status = queryString(req.query.status) as PaymentStatus | undefined;
    const from   = queryString(req.query.from);
    const to     = queryString(req.query.to);
    const page   = parseInt(queryString(req.query.page)  ?? '1');
    const limit  = parseInt(queryString(req.query.limit) ?? '20');
    const skip   = (page - 1) * limit;

    const where: any = {};
    if (method)    where.method    = method;
    if (status)    where.status    = status;
    if (from || to) where.createdAt = buildDateRange(from, to);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              category: true,
              totalAmount: true,
              status: true,
              business: { select: { id: true, businessName: true, ownerName: true } },
            },
          },
          // paidBy is a User relation via paidById
          paidBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    return sendSuccess(res, {
      data: payments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/auditor/payments/:id
 * Single payment with full invoice and business context.
 * Note: confirmedById is a plain String — not a relation in schema,
 * so we do a separate lookup if needed.
 */
export const getPaymentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: {  id: String(id) },
      include: {
        invoice: {
          include: {
            business:        { select: { id: true, businessName: true, ownerName: true, phone: true, address: true } },
            assignedOfficer: { select: { id: true, firstName: true, lastName: true } },
            createdBy:       { select: { id: true, firstName: true, lastName: true, role: true } },
            receipt:         { select: { id: true, receiptNumber: true, issuedAt: true } },
          },
        },
        paidBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });

    if (!payment) return sendError(res, 'Payment not found', 'NOT_FOUND', null, 404);

    // Resolve confirmedById separately since it has no Prisma relation
    let confirmedBy = null;
    if (payment.confirmedById) {
      confirmedBy = await prisma.user.findUnique({
        where: { id: payment.confirmedById },
        select: { id: true, firstName: true, lastName: true, role: true },
      });
    }

    return sendSuccess(res, { ...payment, confirmedBy });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// RECEIPTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auditor/receipts
 * All receipts — filterable by officer and date range.
 */
export const getAllReceipts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const officerId = queryString(req.query.officerId);
    const from      = queryString(req.query.from);
    const to        = queryString(req.query.to);
    const page      = parseInt(queryString(req.query.page)  ?? '1');
    const limit     = parseInt(queryString(req.query.limit) ?? '20');
    const skip      = (page - 1) * limit;

    const where: any = {};
    if (officerId)  where.issuedById = officerId;
    if (from || to) where.issuedAt   = buildDateRange(from, to);

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        skip,
        take: limit,
        include: {
          issuedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              category: true,
              totalAmount: true,
              business: { select: { id: true, businessName: true, ownerName: true } },
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.receipt.count({ where }),
    ]);

    return sendSuccess(res, {
      data: receipts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/auditor/receipts/verify/:code
 * Auditor verifies a receipt by code or QR token.
 * Logs the verification action.
 */
export const verifyReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = Array.isArray(req.params.code) 
      ? req.params.code[0] 
      : req.params.code;
    const auditorId  = req.user!.id;

    const receipt = await prisma.receipt.findFirst({
      where: {
        OR: [{ verificationCode: code }, { qrToken: code }],
      },
      include: {
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
        invoice: {
          include: {
            business: { select: { businessName: true, ownerName: true, address: true } },
          },
        },
      },
    });

    if (!receipt) {
      return sendError(res, 'Receipt not found or invalid code', 'NOT_FOUND', null, 404);
    }

    await prisma.auditLog.create({
      data: {
        action: 'receipt_verified',
        entity: 'Receipt',
        entityId: receipt.id,
        userId: auditorId,
        details: { verifiedBy: 'auditor', code },
      },
    });

    return sendSuccess(res, {
      valid: true,
      receiptNumber: receipt.receiptNumber,
      amountPaid:    receipt.amountPaid,
      issuedAt:      receipt.issuedAt,
      issuedBy:      `${receipt.issuedBy.firstName} ${receipt.issuedBy.lastName}`,
      category:      receipt.invoice.category,
      business:      receipt.invoice.business ?? null,
      issuingAuthority: 'Ijebu North East Local Government',
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// SUSPICIOUS ACTIVITY
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auditor/suspicious
 * Flags potentially suspicious payment activity:
 * 1. Payments above ₦500,000 (large single transactions)
 * 2. Same business paid more than once on same day for same category
 * 3. Payments marked confirmed with no gatewayRef AND no confirmedById (orphaned)
 */
export const getSuspiciousActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from  = queryString(req.query.from);
    const to    = queryString(req.query.to);
    const page  = parseInt(queryString(req.query.page)  ?? '1');
    const limit = parseInt(queryString(req.query.limit) ?? '20');
    const skip  = (page - 1) * limit;
    const dateRange = buildDateRange(from, to);

    const LARGE_TRANSACTION_THRESHOLD = 500000;

    const [largePayments, orphanedPayments, duplicateGroups] = await Promise.all([

      // 1. Large single payments
      prisma.payment.findMany({
        where: {
          amount:    { gte: LARGE_TRANSACTION_THRESHOLD },
          status:    'confirmed',
          createdAt: dateRange,
        },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              category: true,
              business: { select: { businessName: true, ownerName: true } },
            },
          },
          paidBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { amount: 'desc' },
        skip,
        take: limit,
      }),

      // 2. Confirmed payments with no gateway ref AND no confirmedById
      prisma.payment.findMany({
        where: {
          status:       'confirmed',
          gatewayRef:   null,
          confirmedById: null,
          createdAt:    dateRange,
        },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              category: true,
              business: { select: { businessName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),

      // 3. Businesses with multiple confirmed payments for same category in one day
      prisma.payment.groupBy({
        by:    ['invoiceId'],
        where: { status: 'confirmed', createdAt: dateRange },
        _count: { _all: true },
        having: { invoiceId: { _count: { gt: 1 } } },
      }),
    ]);

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },
      flags: {
        largeTransactions: {
          threshold: `₦${LARGE_TRANSACTION_THRESHOLD.toLocaleString()}`,
          count: largePayments.length,
          data:  largePayments,
        },
        orphanedConfirmations: {
          description: 'Payments confirmed with no gateway reference and no confirming officer',
          count: orphanedPayments.length,
          data:  orphanedPayments,
        },
        duplicatePayments: {
          description: 'Invoices with more than one confirmed payment recorded',
          count: duplicateGroups.length,
          invoiceIds: duplicateGroups.map((g) => g.invoiceId),
        },
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// RECONCILIATION (read-only — same data as Treasurer)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auditor/reconciliation
 * Invoice vs payment reconciliation — read-only view for auditor.
 */
export const getReconciliation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from  = queryString(req.query.from);
    const to    = queryString(req.query.to);
    const page  = parseInt(queryString(req.query.page)  ?? '1');
    const limit = parseInt(queryString(req.query.limit) ?? '20');
    const skip  = (page - 1) * limit;
    const dateRange = buildDateRange(from, to);

    const where = { createdAt: dateRange };

    const [invoices, total, summary] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          business:  { select: { id: true, businessName: true, ownerName: true } },
          payments:  {
            where:  { status: 'confirmed' },
            select: { id: true, amount: true, method: true, confirmedAt: true, reference: true },
          },
          receipt:   { select: { id: true, receiptNumber: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where,
        _sum: { totalAmount: true, amountPaid: true, balanceDue: true },
      }),
    ]);

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },
      summary: {
        totalInvoiced:    summary._sum.totalAmount  ?? 0,
        totalCollected:   summary._sum.amountPaid   ?? 0,
        totalOutstanding: summary._sum.balanceDue   ?? 0,
        variance: Number(summary._sum.totalAmount ?? 0) - Number(summary._sum.amountPaid ?? 0),
      },
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};