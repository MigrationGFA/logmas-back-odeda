// src/modules/contractor/contractor.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { RevenueCategory } from '@prisma/client';
import { queryString } from '../complaints/complaints.controller';

/**
 * GET /api/v1/contractor/officers
 * Contractor views their assigned field officers.
 */
export const getMyOfficers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contractorId = req.user!.id;

    const officers = await prisma.user.findMany({
      where: {
        contractorId,
        role: { in: ['field_officer', 'agent'] },
        deletedAt: null,
      },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, role: true,
        isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return sendSuccess(res, officers);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/contractor/officers/:officerId/collections
 * Contractor monitors a specific officer's collection activity.
 * Scoped — contractor can only see their own officers.
 */
export const getOfficerCollections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contractorId = req.user!.id;
        let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const {  } = req.params;
    const date     = queryString(req.query.date);
    const category = queryString(req.query.category) as RevenueCategory | undefined;
    const page     = parseInt(queryString(req.query.page)  ?? '1');
    const limit    = parseInt(queryString(req.query.limit) ?? '10');
    const skip     = (page - 1) * limit;

    // Scope check — officer must belong to this contractor
    const officer = await prisma.user.findFirst({
      where: { id, contractorId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    if (!officer) {
      return sendError(
        res,
        'Officer not found or does not belong to your team',
        'FORBIDDEN',
        null,
        403
      );
    }

    const targetDate  = date ? new Date(date) : new Date();
    const startOfDay  = new Date(new Date(targetDate).setHours(0,  0,  0,   0));
    const endOfDay    = new Date(new Date(targetDate).setHours(23, 59, 59, 999));

    const where: any = {
      assignedOfficerId: id,
      createdAt: { gte: startOfDay, lte: endOfDay },
      ...(category && { category }),
    };

    const [invoices, total, summary] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          business: { select: { id: true, businessName: true, ownerName: true } },
          payments: { take: 1, orderBy: { createdAt: 'desc' } },
          receipt:  { select: { id: true, receiptNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where,
        _sum: { amountPaid: true, totalAmount: true },
        _count: { _all: true },
      }),
    ]);

    return sendSuccess(res, {
      officer,
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        totalInvoiced:    summary._sum.totalAmount ?? 0,
        totalCollected:   summary._sum.amountPaid  ?? 0,
        totalTransactions: summary._count._all,
        date: startOfDay,
      },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/contractor/summary
 * Contractor gets aggregated revenue summary across all their officers.
 */
export const getContractorSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contractorId = req.user!.id;

    // Get all officer IDs under this contractor
    const officers = await prisma.user.findMany({
      where: { contractorId, role: { in: ['field_officer', 'agent'] }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });

    const officerIds = officers.map((o) => o.id);

    if (officerIds.length === 0) {
      return sendSuccess(res, {
        officers: [],
        summary: { totalCollected: 0, totalInvoiced: 0, totalTransactions: 0 },
        byOfficer: [],
        byCategory: [],
      });
    }

    const today = new Date();
    const startOfToday = new Date(new Date(today).setHours(0, 0, 0, 0));

    const [allTimeSummary, todaySummary, byOfficer, byCategory] = await Promise.all([
      // All time totals across all officers
      prisma.invoice.aggregate({
        where: { assignedOfficerId: { in: officerIds } },
        _sum: { amountPaid: true, totalAmount: true },
        _count: { _all: true },
      }),

      // Today only
      prisma.invoice.aggregate({
        where: {
          assignedOfficerId: { in: officerIds },
          createdAt: { gte: startOfToday },
        },
        _sum: { amountPaid: true, totalAmount: true },
        _count: { _all: true },
      }),

      // Breakdown per officer
      prisma.invoice.groupBy({
        by: ['assignedOfficerId'],
        where: { assignedOfficerId: { in: officerIds } },
        _sum: { amountPaid: true, totalAmount: true },
        _count: { _all: true },
      }),

      // Breakdown by revenue category
      prisma.invoice.groupBy({
        by: ['category'],
        where: { assignedOfficerId: { in: officerIds } },
        _sum: { amountPaid: true },
        _count: { _all: true },
      }),
    ]);

    // Enrich per-officer breakdown with names
    const officerMap = Object.fromEntries(officers.map((o) => [o.id, o]));
    const enrichedByOfficer = byOfficer.map((row) => ({
      officer: officerMap[row.assignedOfficerId!] ?? { id: row.assignedOfficerId },
      collected:    row._sum.amountPaid  ?? 0,
      invoiced:     row._sum.totalAmount ?? 0,
      transactions: row._count._all,
    }));

    return sendSuccess(res, {
      officers: officers.length,
      today: {
        collected:    todaySummary._sum.amountPaid  ?? 0,
        invoiced:     todaySummary._sum.totalAmount ?? 0,
        transactions: todaySummary._count._all,
      },
      allTime: {
        collected:    allTimeSummary._sum.amountPaid  ?? 0,
        invoiced:     allTimeSummary._sum.totalAmount ?? 0,
        transactions: allTimeSummary._count._all,
      },
      byOfficer: enrichedByOfficer,
      byCategory: byCategory.map((c) => ({
        category:     c.category,
        collected:    c._sum.amountPaid ?? 0,
        transactions: c._count._all,
      })),
    });
  } catch (err) { next(err); }
};