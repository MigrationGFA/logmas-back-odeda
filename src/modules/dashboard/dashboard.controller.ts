import {
  Role,
  InvoiceStatus,
  ApplicationStatus,
  ComplaintStatus,
  User,
  PaymentStatus,
  PaymentMethod,
} from "@prisma/client";
import { prisma } from "../../utils/prisma";

export const fetchMetricsByRole = async (
  role: Role,
  userId: string,
  user: User,
) => {
  switch (role) {
    case Role.citizen: {
      const [applications, complaints, invoices] = await Promise.all([
        prisma.application.findMany({
          where: { applicantId: userId },
          include: {
            service: { select: { code: true, name: true } },
            applicationDocuments: { select: { id: true } },
            invoice: { select: { amount: true, paymentStatus: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        prisma.complaint.count({ where: { raisedById: userId, status: { not: ComplaintStatus.closed } } }),
        prisma.invoice.findMany({ where: { application: { applicantId: userId } }, select: { id: true, amount: true, paymentStatus: true } }),
      ]);

      const statusCounts = applications.reduce((acc: Record<string, number>, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const pendingPaymentAmount = invoices.reduce((sum, inv) => {
        return sum + (inv.paymentStatus === PaymentStatus.confirmed ? 0 : Number(inv.amount ?? 0));
      }, 0);

      return {
        metrics: {
          pendingPayments: pendingPaymentAmount,
          approvedApplications: statusCounts[ApplicationStatus.approved] ?? 0,
          underReview: statusCounts[ApplicationStatus.under_review] ?? 0,
          submitted: statusCounts[ApplicationStatus.submitted] ?? 0,
          openComplaints: complaints,
        },
        recentApplications: applications.map((a) => ({
          id: a.id,
          applicationNumber: a.applicationNumber,
          service: a.service?.name ?? a.service?.code,
          status: a.status,
          feeAmount: Number(a.feeAmount ?? 0),
          createdAt: a.createdAt,
        })),
      };
    }

    case Role.business_owner: {
      const [applications, invoices, recentApplications] = await Promise.all([
        prisma.application.count({ where: { OR: [{ applicantId: userId }, { createdById: userId }] } }),
        prisma.invoice.findMany({ where: { application: { OR: [{ applicantId: userId }, { createdById: userId }] } }, select: { id: true, amount: true, paymentStatus: true } }),
        prisma.application.findMany({ where: { OR: [{ applicantId: userId }, { createdById: userId }] }, include: { service: { select: { name: true } }, invoice: { select: { amount: true, paymentStatus: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
      ]);

      const totalPaid = invoices.reduce((s, inv) => s + (inv.paymentStatus === PaymentStatus.confirmed ? Number(inv.amount ?? 0) : 0), 0);
      const outstanding = invoices.reduce((s, inv) => s + (inv.paymentStatus === PaymentStatus.confirmed ? 0 : Number(inv.amount ?? 0)), 0);

      return {
        metrics: {
          totalApplications: applications,
          totalPaid,
          outstanding,
        },
        recentApplications: recentApplications.map((a) => ({
          id: a.id,
          applicationNumber: a.applicationNumber,
          service: a.service?.name,
          status: a.status,
          amount: Number(a.invoice?.amount ?? a.feeAmount ?? 0),
        })),
      };
    }

    case Role.treasurer: {
      // Treasurer: aggregate confirmed payments and invoices
      const [confirmedPayments, pendingInvoices, activeOfficers] = await Promise.all([
        prisma.payment.findMany({ where: { status: PaymentStatus.confirmed }, include: { invoice: { include: { application: { include: { service: { select: { name: true } } } } } } } }),
        prisma.invoice.findMany({ where: { paymentStatus: { not: PaymentStatus.confirmed } }, select: { id: true, amount: true } }),
        prisma.user.count({ where: { role: Role.field_officer, isActive: true } }),
      ]);

      const totalRevenue = confirmedPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
      const pendingAmount = pendingInvoices.reduce((s, inv) => s + Number(inv.amount ?? 0), 0);

      // Monthly revenue by confirmed payments
      const monthlyMap: Record<string, number> = {};
      confirmedPayments.forEach((p) => {
        const m = new Date(p.createdAt).getMonth();
        const key = String(m + 1);
        monthlyMap[key] = (monthlyMap[key] || 0) + Number(p.amount ?? 0);
      });

      const revenueTrend = Array.from({ length: 12 }).map((_, i) => ({ month: i + 1, amount: monthlyMap[String(i + 1)] ?? 0 }));

      // Service breakdown
      const serviceMap: Record<string, number> = {};
      confirmedPayments.forEach((p) => {
        const svc = p.invoice?.application?.service?.name ?? 'Other';
        serviceMap[svc] = (serviceMap[svc] || 0) + Number(p.amount ?? 0);
      });

      const serviceBreakdown = Object.entries(serviceMap).map(([service, amount]) => ({ service, amount }));

      return {
        metrics: {
          totalRevenue,
          pendingAmount,
          activeOfficers,
          transactionCount: confirmedPayments.length,
        },
        revenueTrend,
        serviceBreakdown,
      };
    }

    case Role.lga_admin:
    case Role.super_admin: {
      const [totalApplications, totalUsers, activeFieldOfficers, auditEvents] = await Promise.all([
        prisma.application.count(),
        prisma.user.count(),
        prisma.user.count({ where: { role: Role.field_officer, isActive: true } }),
        prisma.auditLog.count(),
      ]);

      return {
        metrics: {
          totalApplications,
          totalUsers,
          activeFieldOfficers,
          auditEvents,
        },
      };
    }

    case Role.field_officer: {
      const [apps, recentApps] = await Promise.all([
        prisma.application.findMany({ where: { createdById: userId }, select: { id: true, status: true } }),
        prisma.application.findMany({ where: { createdById: userId }, include: { service: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
      ]);

      const counts = apps.reduce((acc: Record<string, number>, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {} as Record<string, number>);

      return {
        metrics: {
          totalSubmitted: apps.length,
          submitted: counts[ApplicationStatus.submitted] ?? 0,
          underReview: counts[ApplicationStatus.under_review] ?? 0,
          approved: counts[ApplicationStatus.approved] ?? 0,
          declined: counts[ApplicationStatus.declined] ?? 0,
        },
        recentApplications: recentApps.map((a) => ({ id: a.id, applicationNumber: a.applicationNumber, service: a.service?.name, status: a.status })),
      };
    }

    case Role.auditor: {
      const [confirmedPaymentsAgg, outstandingInvoices, receiptsCount, auditEventsCount, activeOfficers, paymentMethods] = await Promise.all([
        prisma.payment.aggregate({ where: { status: PaymentStatus.confirmed }, _sum: { amount: true } }),
        prisma.invoice.findMany({ where: { paymentStatus: { not: PaymentStatus.confirmed } }, select: { id: true, amount: true } }),
        prisma.receipt.count(),
        prisma.auditLog.count(),
        prisma.user.count({ where: { role: Role.field_officer, isActive: true } }),
        prisma.payment.groupBy({ by: ['method'], where: { status: PaymentStatus.confirmed }, _sum: { amount: true } }),
      ]);

      const totalCollected = Number(confirmedPaymentsAgg._sum.amount ?? 0);
      const outstanding = outstandingInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);

      return {
        metrics: {
          totalCollected,
          outstanding,
          receiptsCount,
          auditEvents: auditEventsCount,
          activeOfficers,
        },
        paymentMethods: paymentMethods.map((p) => ({ method: p.method, amount: Number(p._sum.amount ?? 0) })),
      };
    }

    default:
      return { message: 'No specific metrics defined for this role.', metrics: {} };
  }
};

import { Request, Response, NextFunction } from "express";
export const getDashboardOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Safely extract token payload properties
    const { id: userId, role } = (req as any).user as {
      id: string;
      role: Role;
    };

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      sendError(
        res,
        "User record profile could not be localized",
        "NOT_FOUND",
        null,
        404,
      );
      return;
    }

    // Invoke our extracted service helper
    const payload = await fetchMetricsByRole(role, userId, user);

    res.status(200).json({
      success: true,
      role,
      ...payload,
    });
  } catch (error: any) {
    // If our service threw a profile validation error, catch it gracefully
    if (error.message?.includes("missing")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { sendError } from "../../utils/response";
// Adjust to your auth file location

const router = Router();

// Protect endpoint with your standard access token decoding middleware
router.get("/overview", requireAuth, getDashboardOverview);

export default router;
