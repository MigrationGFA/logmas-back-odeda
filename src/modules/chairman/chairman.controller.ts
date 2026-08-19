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
    lte: to ? new Date(to) : now,
  };
};

/**
 * GET /api/v1/chairman/overview
 * Top-level KPIs for executive dashboard (aligned with current schema).
 */
export const getChairmanOverview = async (req: any, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const dateRange = buildDateRange(from, to);

    const [
      revenueSummary,
      activeOfficersCount,
      unpaidInvoicesCount,
      applicationStats,
      complaintStats,
      totalWards,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { createdAt: dateRange },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.user.count({ where: { role: 'field_officer', isActive: true } }),
      prisma.invoice.count({ where: { paymentStatus: 'pending' } }),
      prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.complaint.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.ward.count(),
    ]);

    const apps = applicationStats.reduce((acc: Record<string, number>, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, {});

    const complaints = complaintStats.reduce((acc: Record<string, number>, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, {});

    const totalRevenue = Number(revenueSummary._sum.amount ?? 0);
    const pendingApplications = apps['submitted'] ?? apps['draft'] ?? 0;
    const approvedApplications = apps['approved'] ?? 0;
    const openComplaints = complaints['open'] ?? 0;

    return sendSuccess(res, {
      success: true,
      role: 'chairman',
      metrics: {
        totalRevenue,
        overdueInvoices: unpaidInvoicesCount,
        wardCoverage: totalWards,
        pendingApplications,
        approvedApplications,
        openComplaints,
        activeOfficersCount,
        totalInvoicesCount: revenueSummary._count._all,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/chairman/revenue
 * Revenue summary and simple trends.
 */
export const getRevenueTrend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    const dateRange = buildDateRange(from, to);

    const [invoiced, collected, paymentsRaw, byService] = await Promise.all([
      prisma.invoice.aggregate({ where: { createdAt: dateRange }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.payment.aggregate({ where: { status: 'confirmed', createdAt: dateRange }, _sum: { amount: true }, _count: { _all: true } }),
      // fetch confirmed payments in range and aggregate in JS to avoid TS circular type issues
      prisma.payment.findMany({ where: { status: 'confirmed', createdAt: dateRange }, select: { amount: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
      prisma.application.groupBy({ by: ['serviceId'], where: { createdAt: dateRange }, _sum: { feeAmount: true }, _count: { _all: true }, orderBy: { _sum: { feeAmount: 'desc' } } }),
    ]);

    // Resolve service metadata for serviceIds returned by groupBy
    const serviceIds = byService.map((b) => b.serviceId);
    const services = serviceIds.length ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, code: true, name: true } }) : [];
    const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));

    // Aggregate daily payments (group by YYYY-MM-DD)
    const dailyMap = new Map<string, { date: string; collected: number; transactions: number }>();
    for (const p of paymentsRaw) {
      const d = new Date(p.createdAt as unknown as Date);
      const key = d.toISOString().slice(0, 10);
      const entry = dailyMap.get(key) ?? { date: key, collected: 0, transactions: 0 };
      entry.collected += Number(p.amount ?? 0);
      entry.transactions += 1;
      dailyMap.set(key, entry);
    }
    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },
      totals: {
        invoiced: Number(invoiced._sum.amount ?? 0),
        collected: Number(collected._sum.amount ?? 0),
        invoiceCount: invoiced._count._all,
        paymentsCount: collected._count._all,
      },
      byService: byService.map((b) => ({ service: serviceMap[b.serviceId] ?? { id: b.serviceId }, totalInvoiced: Number(b._sum.feeAmount ?? 0), applicationCount: b._count._all })),
      dailyTrend,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/chairman/wards
 * Ward performance — counts for users and complaints.
 */
export const getWardPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wards = await prisma.ward.findMany({
      include: { _count: { select: { complaints: true, users: true } } },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, { wards });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/chairman/applications
 * Application stats by status and by service.
 */
export const getApplicationStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [byStatus, byService] = await Promise.all([
      prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.application.groupBy({ by: ['serviceId'], _count: { _all: true } }),
    ]);

    const serviceIds = byService.map((s) => s.serviceId);
    const services = serviceIds.length ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, code: true, name: true } }) : [];
    const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));

    return sendSuccess(res, {
      byStatus: byStatus.reduce((acc: Record<string, number>, s) => { acc[s.status] = s._count._all; return acc; }, {}),
      byService: byService.map((s) => ({ service: serviceMap[s.serviceId] ?? { id: s.serviceId }, count: s._count._all })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/chairman/complaints
 * Complaint overview with breakdown by status and top wards.
 */
export const getComplaintOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [byStatus, byWard] = await Promise.all([
      prisma.complaint.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.complaint.groupBy({ by: ['wardId'], _count: { _all: true } }),
    ]);

    const wardIds = byWard.map((w) => w.wardId).filter(Boolean) as string[];
    const wards = wardIds.length ? await prisma.ward.findMany({ where: { id: { in: wardIds } }, select: { id: true, name: true } }) : [];
    const wardMap = Object.fromEntries(wards.map((w) => [w.id, w]));

    const statusMap = byStatus.reduce((acc: Record<string, number>, s) => { acc[s.status] = s._count._all; return acc; }, {});

    return sendSuccess(res, {
      total: Object.values(statusMap).reduce((s, c) => s + c, 0),
      breakdown: statusMap,
      open: statusMap['open'] ?? 0,
      inProgress: statusMap['in_progress'] ?? statusMap['assigned'] ?? 0,
      resolved: statusMap['resolved'] ?? 0,
      topWards: byWard.map((w) => ({ ward: wardMap[w.wardId] ?? { id: w.wardId }, count: w._count._all })),
    });
  } catch (err) {
    next(err);
  }
};