// src/modules/reports/reports.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess } from '../../utils/response';
import { queryString } from '../complaints/complaints.controller';

// ── Paystack-style period presets ─────────────────────────────
// period=yesterday | last_week | this_month | all | custom (with from/to)
function buildDateRange(period?: string | null, from?: string | null, to?: string | null) {
  const now = new Date();

  // Explicit from/to always wins, regardless of period — this is the "custom" case.
  if (from && !isNaN(Date.parse(from)) && to && !isNaN(Date.parse(to))) {
    return { gte: new Date(from), lte: new Date(to) };
  }

  switch (period) {
    case 'all':
      return undefined; // no date filter at all

    case 'yesterday': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return { gte: start, lte: end };
    }

    case 'last_week': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
      return { gte: start, lte: now };
    }

    case 'this_month':
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { gte: start, lte: end };
    }
  }
}

// Returns { [field]: dateRange } normally, or {} when dateRange is undefined
// (the "all" case) — so the Prisma where clause just omits the filter entirely
// rather than filtering on an undefined range.
function dateFilter(field: string, dateRange?: { gte: Date; lte: Date }) {
  return dateRange ? { [field]: dateRange } : {};
}

/**
 * GET /api/v1/reports/overview?period=yesterday|last_week|this_month|all&from=&to=
 * Serves all data needed for the Reports page in one call.
 */
export const getReportsOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = queryString(req.query.period);
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    const dateRange = buildDateRange(period, from, to);

    const [
      paymentsByMethod,
      receiptsWithContext, // renamed — now includes enough to classify service type
      invoicesByOfficer,
      recentInvoices,
      recentReceipts,
    ] = await Promise.all([
      prisma.payment.groupBy({
        by: ['method'],
        where: { status: 'confirmed', ...dateFilter('createdAt', dateRange) },
        _sum: { amount: true },
        _count: { _all: true },
      }),

      // Revenue grouped by service — now pulls enough of the invoice's relations
      // to classify SOO vs Permit vs plain Levy, not just category name.
      prisma.receipt.findMany({
        where: dateFilter('issuedAt', dateRange),
        include: {
          invoice: {
            select: {
              category: { select: { name: true, type: true } },
              stateOfOriginApplication: { select: { id: true } },
              permit: { select: { id: true } },
            },
          },
        },
      }),

      prisma.invoice.groupBy({
        by: ['assignedOfficerId'],
        where: { ...dateFilter('createdAt', dateRange), assignedOfficerId: { not: null } },
        _sum: { amountPaid: true, totalAmount: true },
        _count: { _all: true },
      }),

      prisma.invoice.findMany({
        where: dateFilter('createdAt', dateRange),
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          business: { select: { businessName: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          category: { select: { name: true, slug: true } },
        },
      }),

      prisma.receipt.findMany({
        where: dateFilter('issuedAt', dateRange),
        take: 20,
        orderBy: { issuedAt: 'desc' },
        include: {
          issuedBy: { select: { firstName: true, lastName: true } },
          invoice: {
            include: {
              business: { select: { businessName: true } },
              createdBy: { select: { firstName: true, lastName: true } },
              category: { select: { name: true } },
              payments: {
                where: { status: 'confirmed' },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { method: true },
              },
            },
          },
        },
      }),
    ]);

    // ── Officer enrichment ────────────────────────────────────
    const officerIds = invoicesByOfficer.map((r) => r.assignedOfficerId).filter(Boolean) as string[];
    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds } },
      select: { id: true, firstName: true, lastName: true, ward: { select: { name: true } } },
    });
    const officerMap = Object.fromEntries(officers.map((o) => [o.id, o]));

    // ── Stat cards ─────────────────────────────────────────────
    const totalRevenue = paymentsByMethod.reduce((sum, m) => sum + Number(m._sum.amount ?? 0), 0);
    const byMethod = paymentsByMethod.reduce((acc: Record<string, number>, m) => {
      acc[m.method] = Number(m._sum.amount ?? 0);
      return acc;
    }, {});

    // ── Classify every receipt by service type AND category in one pass ──
    const serviceTypeMap: Record<string, { transactions: number; revenue: number }> = {
      state_of_origin: { transactions: 0, revenue: 0 },
      permit: { transactions: 0, revenue: 0 },
      levy: { transactions: 0, revenue: 0 },
    };
    const levyMap: Record<string, { type: string; transactions: number; revenue: number }> = {};

    for (const r of receiptsWithContext) {
      const isStateOfOrigin = !!r.invoice?.stateOfOriginApplication;
      const isPermit = !!r.invoice?.permit;
      const serviceType = isStateOfOrigin ? 'state_of_origin' : isPermit ? 'permit' : 'levy';

      serviceTypeMap[serviceType].transactions += 1;
      serviceTypeMap[serviceType].revenue += Number(r.amountPaid);

      const categoryKey = r.invoice?.category?.name ?? 'Other';
      if (!levyMap[categoryKey]) levyMap[categoryKey] = { type: serviceType, transactions: 0, revenue: 0 };
      levyMap[categoryKey].transactions += 1;
      levyMap[categoryKey].revenue += Number(r.amountPaid);
    }

    const byServiceType = [
      { type: 'state_of_origin', label: 'State of Origin', ...serviceTypeMap.state_of_origin },
      { type: 'permit', label: 'Trade Permits', ...serviceTypeMap.permit },
      { type: 'levy', label: 'Levies', ...serviceTypeMap.levy },
    ];

    const byLevy = Object.entries(levyMap)
      .map(([levy, data]) => ({ levy, type: data.type, transactions: data.transactions, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── By officer ─────────────────────────────────────────────
    const byOfficer = invoicesByOfficer
      .map((row) => {
        const officer = officerMap[row.assignedOfficerId!];
        return {
          id: row.assignedOfficerId,
          name: officer ? `${officer.firstName} ${officer.lastName}` : 'Unknown',
          ward: officer?.ward?.name ?? '—',
          invoicesIssued: row._count._all,
          totalCollected: Number(row._sum.amountPaid ?? 0),
          totalInvoiced: Number(row._sum.totalAmount ?? 0),
        };
      })
      .sort((a, b) => b.totalCollected - a.totalCollected);

    // ── Invoices / receipts tabs ────────────────────────────────
    const invoices = recentInvoices.map((inv) => ({
      id: inv.id,
      reference: inv.invoiceNumber,
      customerName: inv.business?.businessName ?? `${inv.createdBy.firstName} ${inv.createdBy.lastName}`,
      levyType: inv.category?.name ?? inv.category?.slug ?? '—',
      status: inv.status,
      amount: Number(inv.totalAmount),
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
    }));

    const receipts = recentReceipts.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      customerName: r.invoice.business?.businessName ?? `${r.invoice.createdBy.firstName} ${r.invoice.createdBy.lastName}`,
      paymentMethod: r.invoice.payments?.[0]?.method ?? 'online_gateway',
      officerName: `${r.issuedBy.firstName} ${r.issuedBy.lastName}`,
      amount: Number(r.amountPaid),
      levyType: r.invoice.category?.name ?? '—',
      paidAt: r.issuedAt,
    }));

    return sendSuccess(res, {
      period: { preset: period ?? 'this_month', from: dateRange?.gte ?? null, to: dateRange?.lte ?? null },

      stats: {
        totalRevenue,
        byMethod: {
          transfer: byMethod['bank_transfer'] ?? 0,
          pos: byMethod['pos'] ?? 0,
          cash: byMethod['cash'] ?? 0,
          online: byMethod['online_gateway'] ?? byMethod['virtual_account'] ?? 0,
        },
      },

      // NEW — this is what your boss asked for: the 3-way service breakdown
      byServiceType,

      // byLevy now carries a `type` tag per row so the frontend can group/filter
      // within this tab by service type too, not just show a flat category list
      byLevy,

      byOfficer,
      invoices,
      receipts,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/export/invoices
 * Returns full invoice list for CSV export — no pagination limit.
 */
export const exportInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = queryString(req.query.from);
    const to   = queryString(req.query.to);
    const dateRange = buildDateRange(from, to);

    const invoices = await prisma.invoice.findMany({
      where: { createdAt: dateRange },
      orderBy: { createdAt: 'desc' },
      include: {
        business:  { select: { businessName: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        category:  { select: { name: true } },
      },
    });

    return sendSuccess(res, invoices.map((inv) => ({
      reference:    inv.invoiceNumber,
      customerName: inv.business?.businessName
        ?? `${inv.createdBy.firstName} ${inv.createdBy.lastName}`,
      levyType:  inv.category?.name ?? '—',
      status:    inv.status,
      amount:    Number(inv.totalAmount),
      amountPaid: Number(inv.amountPaid),
      balanceDue: Number(inv.balanceDue),
      dueDate:   inv.dueDate?.toISOString().split('T')[0] ?? '—',
      createdAt: inv.createdAt.toISOString().split('T')[0],
    })));
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/reports/export/receipts
 * Returns full receipt list for CSV export — no pagination limit.
 */
export const exportReceipts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = queryString(req.query.from);
    const to   = queryString(req.query.to);
    const dateRange = buildDateRange(from, to);

    const receipts = await prisma.receipt.findMany({
      where: { issuedAt: dateRange },
      orderBy: { issuedAt: 'desc' },
      include: {
        issuedBy: { select: { firstName: true, lastName: true } },
        invoice: {
          include: {
            business:  { select: { businessName: true } },
            createdBy: { select: { firstName: true, lastName: true } },
            category:  { select: { name: true } },
            payments: {
              where:   { status: 'confirmed' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select:  { method: true },
            },
          },
        },
      },
    });

    return sendSuccess(res, receipts.map((r) => ({
      receiptNumber: r.receiptNumber,
      customerName:  r.invoice.business?.businessName
        ?? `${r.invoice.createdBy.firstName} ${r.invoice.createdBy.lastName}`,
      levyType:      r.invoice.category?.name ?? '—',
      paymentMethod: r.invoice.payments?.[0]?.method ?? '—',
      officerName:   `${r.issuedBy.firstName} ${r.issuedBy.lastName}`,
      amount:        Number(r.amountPaid),
      paidAt:        r.issuedAt.toISOString().split('T')[0],
    })));
  } catch (err) { next(err); }
};