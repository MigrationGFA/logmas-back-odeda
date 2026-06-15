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
export const getChairmanOverview = async (req: any, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from ? String(req.query.from) : undefined;
    const to   = req.query.to ? String(req.query.to) : undefined;
    const dateRange = buildDateRange(from, to); // Assumes your helper parses this safely

    // 1. Gather all executive statistics in a fast single roundtrip promise block
    const [
      revenueSummary,
      activeOfficersCount,
      unpaidInvoicesCount,
      applicationStats,
      complaintStats,
      permitStats,
      totalWards,
    ] = await Promise.all([
      // Revenue Aggregations
      prisma.invoice.aggregate({
        where: { createdAt: dateRange },
        _sum: { amountPaid: true, totalAmount: true },
        _count: { _all: true },
      }),
      // Active field officer count
      prisma.user.count({
        where: { role: 'field_officer', isActive:true }
      }),
      // Unpaid invoices count
      prisma.invoice.count({
        where: { status: 'sent' }
      }),
      // Application Grouping
      prisma.stateOfOriginApplication.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      // Complaints Grouping
      prisma.complaint.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      // Active Permits Grouping
      prisma.permit.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      // Total operational wards for baseline coverage metrics
      prisma.ward.count({ where: { deletedAt: null } })
    ]);

    // 2. Map Array reductions to object index lookup tables
    const apps = applicationStats.reduce((acc: Record<string, number>, curr) => {
      acc[curr.status] = curr._count._all; return acc;
    }, {});

    const complaints = complaintStats.reduce((acc: Record<string, number>, curr) => {
      acc[curr.status] = curr._count._all; return acc;
    }, {});

    const permits = permitStats.reduce((acc: Record<string, number>, curr) => {
      acc[curr.status] = curr._count._all; return acc;
    }, {});

    // 3. Map values directly into the unified dashboard metrics interface contract
    const totalRevenue = Number(revenueSummary._sum.amountPaid || 0);
    const activePermits = permits['issued'] || 0;
    
    // Tally up specific UI indicators
    const pendingApplications = apps['pending'] || 0;
    const approvedCertificates = apps['approved'] || 0;
    const pendingComplaints = complaints['open'] || complaints['in_progress'] || 0;

    return sendSuccess(res, {
      success: true,
      role: "chairman",
      metrics: {
        // Core Management Schema Parameters
        totalRevenue,
        activePermits,
        overdueInvoices: unpaidInvoicesCount, 
        wardCoverage: totalWards,

        // Specific Chairman UI Hook Data points
        pendingApplications,
        approvedCertificates,
        pendingComplaints,
        activeOfficersCount,
        totalInvoicesCount: revenueSummary._count._all,
        pendingBillsCount: unpaidInvoicesCount
      }
    });

  } catch (err) { 
    next(err); 
  }
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
        by: ['categoryId'],
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
        // category:    c.category,
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
        councillor: { select: { id: true, firstName: true, lastName: true, isActive: true } },
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

    return sendSuccess(res, {wards});
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