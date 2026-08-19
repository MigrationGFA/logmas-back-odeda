// src/modules/reports/reports.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess } from '../../utils/response';
import { queryString } from '../complaints/complaints.controller';
import { Prisma } from '@prisma/client';

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

/**
 * GET /api/v1/reports/overview?period=yesterday|last_week|this_month|all&from=&to=
 *
 * Reports overview.
 *
 * Revenue is calculated from confirmed payments and grouped by
 * the Service attached to each Application.
 */
export const getReportsOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const period = queryString(req.query.period);
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);

    const dateRange = buildDateRange(period, from, to);

    const paymentWhere: Prisma.PaymentWhereInput = {
      status: "confirmed",
      ...(dateRange ? { confirmedAt: dateRange } : {}),
    };

    const [
      payments,
      recentInvoices,
      recentReceipts,
    ] = await Promise.all([
      // All confirmed payments for the selected period.
      // Service is reached through:
      // Payment → Invoice → Application → Service
      prisma.payment.findMany({
        where: paymentWhere,
        select: {
          amount: true,
          method: true,
          confirmedAt: true,

          invoice: {
            select: {
              id: true,
              invoiceNumber: true,

              application: {
                select: {
                  applicationNumber: true,

                  service: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      category: true,
                      revenueHead: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),

      // Recent invoices
      prisma.invoice.findMany({
        where: dateRange ? { createdAt: dateRange } : {},
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          paymentStatus: true,
          paidAt: true,
          createdAt: true,

          application: {
            select: {
              applicationNumber: true,
              formData: true,

              service: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  revenueHead: true,
                },
              },
            },
          },
        },
      }),

      // Recent receipts
      prisma.receipt.findMany({
        where: dateRange ? { issuedAt: dateRange } : {},
        take: 20,
        orderBy: { issuedAt: "desc" },
        select: {
          id: true,
          receiptNumber: true,
          amountPaid: true,
          issuedAt: true,

          issuedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },

          invoice: {
            select: {
              invoiceNumber: true,

              application: {
                select: {
                  applicationNumber: true,
                  formData: true,

                  service: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      revenueHead: true,
                    },
                  },
                },
              },

              payments: {
                where: {
                  status: "confirmed",
                },
                orderBy: {
                  confirmedAt: "desc",
                },
                take: 1,
                select: {
                  method: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // ---------------------------------------------------------
    // Revenue statistics
    // ---------------------------------------------------------

    let totalRevenue = 0;

    const byMethod: Record<string, number> = {};

    const serviceRevenueMap = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        revenueHead: string;
        transactions: number;
        revenue: number;
      }
    >();

    for (const payment of payments) {
      const amount = Number(payment.amount);

      totalRevenue += amount;

      // Payment method breakdown
      const method = payment.method;
      byMethod[method] = (byMethod[method] || 0) + amount;

      // Service breakdown
      const service = payment.invoice.application?.service;

      if (!service) {
        continue;
      }

      const existing = serviceRevenueMap.get(service.id);

      if (existing) {
        existing.revenue += amount;
        existing.transactions += 1;
      } else {
        serviceRevenueMap.set(service.id, {
          id: service.id,
          code: service.code,
          name: service.name,
          revenueHead: service.revenueHead,
          transactions: 1,
          revenue: amount,
        });
      }
    }

    const byService = Array.from(serviceRevenueMap.values()).sort(
      (a, b) => b.revenue - a.revenue,
    );

    // ---------------------------------------------------------
    // Recent invoices
    // ---------------------------------------------------------

    const invoices = recentInvoices.map((invoice) => {
      const formData =
        invoice.application?.formData &&
        typeof invoice.application.formData === "object"
          ? (invoice.application.formData as Record<string, any>)
          : {};

      const customerName =
        formData.fullName ||
        formData.applicantName ||
        formData.ownerName ||
        formData.businessName ||
        formData.companyName ||
        "Unknown";

      return {
        id: invoice.id,
        reference: invoice.invoiceNumber,
        applicationNumber:
          invoice.application?.applicationNumber ?? null,
        customerName,
        service: invoice.application?.service
          ? {
              id: invoice.application.service.id,
              code: invoice.application.service.code,
              name: invoice.application.service.name,
              revenueHead: invoice.application.service.revenueHead,
            }
          : null,
        amount: Number(invoice.amount),
        paymentStatus: invoice.paymentStatus,
        paidAt: invoice.paidAt,
        createdAt: invoice.createdAt,
      };
    });

    // ---------------------------------------------------------
    // Recent receipts
    // ---------------------------------------------------------

    const receipts = recentReceipts.map((receipt) => {
      const formData =
        receipt.invoice.application?.formData &&
        typeof receipt.invoice.application.formData === "object"
          ? (receipt.invoice.application.formData as Record<string, any>)
          : {};

      const customerName =
        formData.fullName ||
        formData.applicantName ||
        formData.ownerName ||
        formData.businessName ||
        formData.companyName ||
        "Unknown";

      const issuedBy = receipt.issuedBy;

      return {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        invoiceNumber: receipt.invoice.invoiceNumber,
        applicationNumber:
          receipt.invoice.application?.applicationNumber ?? null,
        customerName,
        service: receipt.invoice.application?.service
          ? {
              id: receipt.invoice.application.service.id,
              code: receipt.invoice.application.service.code,
              name: receipt.invoice.application.service.name,
              revenueHead: receipt.invoice.application.service.revenueHead,
            }
          : null,
        paymentMethod:
          receipt.invoice.payments[0]?.method ?? null,
        officerName: issuedBy
          ? `${issuedBy.firstName} ${issuedBy.lastName}`.trim()
          : null,
        amount: Number(receipt.amountPaid),
        issuedAt: receipt.issuedAt,
      };
    });

    // ---------------------------------------------------------
    // Response
    // ---------------------------------------------------------

    return sendSuccess(res, {
      period: {
        preset: period ?? "this_month",
        from: dateRange?.gte ?? null,
        to: dateRange?.lte ?? null,
      },

      stats: {
        totalRevenue,

        byMethod: {
          transfer: byMethod["bank_transfer"] ?? 0,
          pos: byMethod["pos"] ?? 0,
          cash: byMethod["cash"] ?? 0,
          online:
            (byMethod["online_gateway"] ?? 0) +
            (byMethod["virtual_account"] ?? 0),
        },
      },

      // Revenue generated by each actual service
      byService,

      invoices,
      receipts,
    });
  } catch (err) {
    next(err);
  }
};

// /**
//  * GET /api/v1/reports/export/invoices
//  * Returns full invoice list for CSV export — no pagination limit.
//  */
// export const exportInvoices = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const from = queryString(req.query.from);
//     const to   = queryString(req.query.to);
//     const dateRange = buildDateRange(from, to);

//     const invoices = await prisma.invoice.findMany({
//       where: { createdAt: dateRange },
//       orderBy: { createdAt: 'desc' },
//       include: {
//         business:  { select: { businessName: true } },
//         createdBy: { select: { firstName: true, lastName: true } },
//         category:  { select: { name: true } },
//       },
//     });

//     return sendSuccess(res, invoices.map((inv) => ({
//       reference:    inv.invoiceNumber,
//       customerName: inv.business?.businessName
//         ?? `${inv.createdBy.firstName} ${inv.createdBy.lastName}`,
//       levyType:  inv.category?.name ?? '—',
//       status:    inv.status,
//       amount:    Number(inv.totalAmount),
//       amountPaid: Number(inv.amountPaid),
//       balanceDue: Number(inv.balanceDue),
//       dueDate:   inv.dueDate?.toISOString().split('T')[0] ?? '—',
//       createdAt: inv.createdAt.toISOString().split('T')[0],
//     })));
//   } catch (err) { next(err); }
// };

// /**
//  * GET /api/v1/reports/export/receipts
//  * Returns full receipt list for CSV export — no pagination limit.
//  */
// export const exportReceipts = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const from = queryString(req.query.from);
//     const to   = queryString(req.query.to);
//     const dateRange = buildDateRange(from, to);

//     const receipts = await prisma.receipt.findMany({
//       where: { issuedAt: dateRange },
//       orderBy: { issuedAt: 'desc' },
//       include: {
//         issuedBy: { select: { firstName: true, lastName: true } },
//         invoice: {
//           include: {
//             business:  { select: { businessName: true } },
//             createdBy: { select: { firstName: true, lastName: true } },
//             category:  { select: { name: true } },
//             payments: {
//               where:   { status: 'confirmed' },
//               orderBy: { createdAt: 'desc' },
//               take: 1,
//               select:  { method: true },
//             },
//           },
//         },
//       },
//     });

//     return sendSuccess(res, receipts.map((r) => ({
//       receiptNumber: r.receiptNumber,
//       customerName:  r.invoice.business?.businessName
//         ?? `${r.invoice.createdBy.firstName} ${r.invoice.createdBy.lastName}`,
//       levyType:      r.invoice.category?.name ?? '—',
//       paymentMethod: r.invoice.payments?.[0]?.method ?? '—',
//       officerName:   `${r.issuedBy.firstName} ${r.issuedBy.lastName}`,
//       amount:        Number(r.amountPaid),
//       paidAt:        r.issuedAt.toISOString().split('T')[0],
//     })));
//   } catch (err) { next(err); }
// };