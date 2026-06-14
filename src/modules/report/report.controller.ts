// src/modules/reports/reports.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess } from '../../utils/response';
import { queryString } from '../complaints/complaints.controller';

const buildDateRange = (from?: string | null, to?: string | null) => {
  const now = new Date();
  
  // Create a clean fallback for the first day of the current month at 00:00:00
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Set fallback end date to the end of the current day at 23:59:59
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return {
    gte: from && !isNaN(Date.parse(from)) ? new Date(from) : defaultStart,
    lte: to && !isNaN(Date.parse(to))     ? new Date(to)   : defaultEnd,
  };
};

/**
 * GET /api/v1/reports/overview
 * Serves all data needed for the Reports page in one call:
 * - Stat cards (total revenue, by payment method)
 * - By levy tab
 * - By officer tab
 * - Recent invoices tab (top 20)
 * - Recent receipts tab (top 20)
 */
export const getReportsOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = queryString(req.query.from);
    const to   = queryString(req.query.to);
    const dateRange = buildDateRange(from, to);

    const [
      // Stat cards
      paymentsByMethod,

      // By levy — group receipts by invoice category
      receiptsByCategory,

      // By officer — invoices assigned to field officers
      invoicesByOfficer,

      // Recent invoices
      recentInvoices,

      // Recent receipts
      recentReceipts,
    ] = await Promise.all([

      // Payment method breakdown — confirmed payments only
      prisma.payment.groupBy({
        by: ['method'],
        where: { status: 'confirmed', createdAt: dateRange },
        _sum:   { amount: true },
        _count: { _all: true },
      }),

      // Revenue grouped by levy category via receipts → invoices
      prisma.receipt.findMany({
        where: { issuedAt: dateRange },
        include: {
          invoice: { select: { category: true } },
        },
      }),

      // Officer performance — group by assignedOfficer
      prisma.invoice.groupBy({
        by: ['assignedOfficerId'],
        where: {
          createdAt: dateRange,
          assignedOfficerId: { not: null },
        },
        _sum:   { amountPaid: true, totalAmount: true },
        _count: { _all: true },
      }),

      // Recent invoices — shaped for the invoices tab table
      prisma.invoice.findMany({
        where: { createdAt: dateRange },
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          business:  { select: { businessName: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          category:  { select: { name: true, slug: true } },
        },
      }),

      // Recent receipts — shaped for the receipts tab table
      prisma.receipt.findMany({
        where: { issuedAt: dateRange },
        take: 20,
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
      }),
    ]);

    // ── Enrich officer data with names ───────────────────────
    const officerIds = invoicesByOfficer
      .map((r) => r.assignedOfficerId)
      .filter(Boolean) as string[];

    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds } },
      select: {
        id: true, firstName: true, lastName: true,
        ward: { select: { name: true } },
      },
    });
    const officerMap = Object.fromEntries(officers.map((o) => [o.id, o]));

    // ── Compute stat cards ───────────────────────────────────
    const totalRevenue = paymentsByMethod.reduce(
      (sum, m) => sum + Number(m._sum.amount ?? 0), 0
    );

    const byMethod = paymentsByMethod.reduce((acc: Record<string, number>, m) => {
      acc[m.method] = Number(m._sum.amount ?? 0);
      return acc;
    }, {});

    // ── By levy aggregation ──────────────────────────────────
    const levyMap: Record<string, { transactions: number; revenue: number }> = {};
    for (const r of receiptsByCategory) {
      const key = r.invoice?.category?.name ?? 'other';
      if (!levyMap[key]) levyMap[key] = { transactions: 0, revenue: 0 };
      levyMap[key].transactions += 1;
      levyMap[key].revenue      += Number(r.amountPaid);
    }

    const byLevy = Object.entries(levyMap).map(([levy, data]) => ({
      levy,
      transactions: data.transactions,
      revenue:      data.revenue,
    })).sort((a, b) => b.revenue - a.revenue);

    // ── By officer ───────────────────────────────────────────
    const byOfficer = invoicesByOfficer.map((row) => {
      const officer = officerMap[row.assignedOfficerId!];
      return {
        id:             row.assignedOfficerId,
        name:           officer ? `${officer.firstName} ${officer.lastName}` : 'Unknown',
        ward:           officer?.ward?.name ?? '—',
        invoicesIssued: row._count._all,
        totalCollected: Number(row._sum.amountPaid ?? 0),
        totalInvoiced:  Number(row._sum.totalAmount ?? 0),
      };
    }).sort((a, b) => b.totalCollected - a.totalCollected);

    // ── Format invoices tab ──────────────────────────────────
    const invoices = recentInvoices.map((inv) => ({
      id:           inv.id,
      reference:    inv.invoiceNumber,
      customerName: inv.business?.businessName
        ?? `${inv.createdBy.firstName} ${inv.createdBy.lastName}`,
      levyType: inv.category?.name ?? inv.category?.slug ?? '—',
      status:   inv.status,
      amount:   Number(inv.totalAmount),
      dueDate:  inv.dueDate,
      paidAt:   inv.paidAt,
    }));

    // ── Format receipts tab ──────────────────────────────────
    const receipts = recentReceipts.map((r) => ({
      id:            r.id,
      receiptNumber: r.receiptNumber,
      customerName:  r.invoice.business?.businessName
        ?? `${r.invoice.createdBy.firstName} ${r.invoice.createdBy.lastName}`,
      paymentMethod: r.invoice.payments?.[0]?.method ?? 'online_gateway',
      officerName:   `${r.issuedBy.firstName} ${r.issuedBy.lastName}`,
      amount:        Number(r.amountPaid),
      levyType:      r.invoice.category?.name ?? '—',
      paidAt:        r.issuedAt,
    }));

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },

      // Stat cards
      stats: {
        totalRevenue,
        byMethod: {
          transfer: byMethod['bank_transfer'] ?? 0,
          pos:      byMethod['pos']           ?? 0,
          cash:     byMethod['cash']          ?? 0,
          online:   byMethod['online_gateway'] ?? byMethod['virtual_account'] ?? 0,
        },
      },

      // Tabs
      byLevy,
      byOfficer,
      invoices,
      receipts,
    });
  } catch (err) { next(err); }
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