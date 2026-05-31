// src/modules/chairman/chairman.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess } from '../../utils/response';
import { queryString } from '../complaints/complaints.controller';

const buildDateRange = (from?: string, to?: string) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    gte: from ? new Date(from) : startOfMonth,
    lte: to   ? new Date(to)   : now,
  };
};

/**
 * GET /api/v1/chairman/overview
 * Top-level KPIs for executive dashboard.
 */
export const getOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = queryString(req.query.from);
    const to   = queryString(req.query.to);
    const dateRange = buildDateRange(from, to);

    const [
      revenueSummary,
      totalBusinesses,
      totalWards,
      applicationStats,
      complaintStats,
      permitStats,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { createdAt: dateRange },
        _sum: { totalAmount: true, amountPaid: true, balanceDue: true },
        _count: { _all: true },
      }),
      prisma.business.count({ where: { isActive: true } }),
      prisma.ward.count({ where: { deletedAt: null } }),
      prisma.stateOfOriginApplication.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.complaint.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.permit.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const applications = applicationStats.reduce((acc: Record<string, number>, s) => {
      acc[s.status] = s._count._all; return acc;
    }, {});

    const complaints = complaintStats.reduce((acc: Record<string, number>, s) => {
      acc[s.status] = s._count._all; return acc;
    }, {});

    const permits = permitStats.reduce((acc: Record<string, number>, s) => {
      acc[s.status] = s._count._all; return acc;
    }, {});

    const collectionRate = revenueSummary._sum.totalAmount
      ? ((Number(revenueSummary._sum.amountPaid) / Number(revenueSummary._sum.totalAmount)) * 100).toFixed(2)
      : '0.00';

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },
      revenue: {
        totalInvoiced:    revenueSummary._sum.totalAmount  ?? 0,
        totalCollected:   revenueSummary._sum.amountPaid   ?? 0,
        totalOutstanding: revenueSummary._sum.balanceDue   ?? 0,
        collectionRate:   `${collectionRate}%`,
        totalInvoices:    revenueSummary._count._all,
      },
      operations: {
        totalBusinesses,
        totalWards,
        applications: {
          total: Object.values(applications).reduce((s, c) => s + c, 0),
          breakdown: applications,
        },
        complaints: {
          total: Object.values(complaints).reduce((s, c) => s + c, 0),
          open:  complaints['open'] ?? 0,
          breakdown: complaints,
        },
        permits: {
          total:  Object.values(permits).reduce((s, c) => s + c, 0),
          issued: permits['issued'] ?? 0,
          breakdown: permits,
        },
      },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/chairman/revenue
 * Revenue trend — by category and daily breakdown.
 */
export const getRevenueTrend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = queryString(req.query.from);
    const to   = queryString(req.query.to);
    const dateRange = buildDateRange(from, to);

    const [byCategory, dailyTrend] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['category'],
        where: { createdAt: dateRange },
        _sum: { totalAmount: true, amountPaid: true },
        _count: { _all: true },
        orderBy: { _sum: { amountPaid: 'desc' } },
      }),
      prisma.payment.groupBy({
        by: ['createdAt'],
        where: { status: 'confirmed', createdAt: dateRange },
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },
      byCategory: byCategory.map((c) => ({
        category:    c.category,
        invoiced:    c._sum.totalAmount ?? 0,
        collected:   c._sum.amountPaid  ?? 0,
        invoiceCount: c._count._all,
      })),
      dailyTrend: dailyTrend.map((d) => ({
        date:         d.createdAt,
        collected:    d._sum.amount ?? 0,
        transactions: d._count._all,
      })),
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/chairman/wards
 * Ward performance comparison — applications, complaints, businesses per ward.
 */
export const getWardPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wards = await prisma.ward.findMany({
      where: { deletedAt: null },
      include: {
        councillors: { select: { id: true, firstName: true, lastName: true, isActive: true } },
        _count: {
          select: {
            complaints: true,
            stateOfOriginApplications: true,
            businesses: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, wards);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/chairman/applications
 * Application stats by status and ward.
 */
export const getApplicationStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [byStatus, byWard] = await Promise.all([
      prisma.stateOfOriginApplication.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.stateOfOriginApplication.groupBy({
        by: ['wardId'],
        _count: { _all: true },
        orderBy: { _count: { wardId: 'desc' } },
      }),
    ]);

    const wardIds = byWard.map((w) => w.wardId);
    const wards = await prisma.ward.findMany({
      where: { id: { in: wardIds } },
      select: { id: true, name: true, code: true },
    });
    const wardMap = Object.fromEntries(wards.map((w) => [w.id, w]));

    return sendSuccess(res, {
      byStatus: byStatus.reduce((acc: Record<string, number>, s) => {
        acc[s.status] = s._count._all; return acc;
      }, {}),
      byWard: byWard.map((w) => ({
        ward:  wardMap[w.wardId] ?? { id: w.wardId },
        count: w._count._all,
      })),
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/chairman/complaints
 * Complaint overview with open count highlighted.
 */
export const getComplaintOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [byStatus, byWard] = await Promise.all([
      prisma.complaint.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.complaint.groupBy({
        by: ['wardId'],
        _count: { _all: true },
        orderBy: { _count: { wardId: 'desc' } },
        take: 10,
      }),
    ]);

    const wardIds = byWard.map((w) => w.wardId);
    const wards = await prisma.ward.findMany({
      where: { id: { in: wardIds } },
      select: { id: true, name: true },
    });
    const wardMap = Object.fromEntries(wards.map((w) => [w.id, w]));

    const statusMap = byStatus.reduce((acc: Record<string, number>, s) => {
      acc[s.status] = s._count._all; return acc;
    }, {});

    return sendSuccess(res, {
      total:     Object.values(statusMap).reduce((s, c) => s + c, 0),
      open:      statusMap['open']        ?? 0,
      inProgress: statusMap['in_progress'] ?? 0,
      resolved:  statusMap['resolved']    ?? 0,
      breakdown: statusMap,
      topWards:  byWard.map((w) => ({
        ward:  wardMap[w.wardId] ?? { id: w.wardId },
        count: w._count._all,
      })),
    });
  } catch (err) { next(err); }
};