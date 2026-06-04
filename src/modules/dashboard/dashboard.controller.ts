import { 
  Role, 
  InvoiceStatus, 
  PermitStatus, 
  ApplicationStatus, 
  ComplaintStatus 
} from '@prisma/client';
import { prisma } from '../../utils/prisma';

export const fetchMetricsByRole = async (role: Role, userId: string) => {
  switch (role) {
    case Role.citizen:
        {
      // 1. Fetch data associated with the user as an applicant or owner
      const [applications, _receipt, complaints, invoices] = await Promise.all([
        prisma.stateOfOriginApplication.findMany({
          where: { applicantId: userId },
        //   select: { status: true }
        }),
        prisma.receipt.count(),
        prisma.complaint.count({
          where: { raisedById: userId, status: { not: ComplaintStatus.closed } }
        }),
        prisma.invoice.findMany({
          where: { 
            OR: [
              { createdById: userId }, // Direct system/self invoices
              { business: { ownerId: userId } } // Business-related invoices
            ] 
          }
        })
      ]);

      // 2. Aggregate metrics for the UI
      const pendingInvoices = invoices.filter(inv => inv.status !== InvoiceStatus.paid);
      const totalPendingAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const approvedApps = applications.filter(a => a.status === ApplicationStatus.approved).length;

      return {
        metrics: {
          pendingPayments: totalPendingAmount,
          approvedApplications: approvedApps,
          openComplaints: complaints,
          recentApplications: applications.slice(0, 5)
        },
     
      };
    }
    case Role.business_owner: {
      // 1. Fetch data associated with the user as an applicant or owner
      const [applications, businesses, complaints, invoices] = await Promise.all([
        prisma.stateOfOriginApplication.findMany({
          where: { applicantId: userId },
          select: { status: true }
        }),
        prisma.business.findMany({
          where: { ownerId: userId, deletedAt: null },
          include: { permits: true }
        }),
        prisma.complaint.count({
          where: { raisedById: userId, status: { not: ComplaintStatus.closed } }
        }),
        prisma.invoice.findMany({
          where: { 
            OR: [
              { createdById: userId }, // Direct system/self invoices
              { business: { ownerId: userId } } // Business-related invoices
            ] 
          }
        })
      ]);

      // 2. Aggregate metrics for the UI
      const totalPermits = businesses.reduce((acc, b) => acc + b.permits.length, 0);
      const pendingInvoices = invoices.filter(inv => inv.status !== InvoiceStatus.paid);
      const totalPendingAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const approvedApps = applications.filter(a => a.status === ApplicationStatus.approved).length;

      return {
        metrics: {
          activePermits: totalPermits,
          pendingPayments: totalPendingAmount,
          approvedApplications: approvedApps,
          openComplaints: complaints
        },
        recentBusinesses: businesses.slice(0, 5).map(b => ({
          name: b.businessName,
          category: b.category,
          status: b.isActive ? 'Active' : 'Inactive'
        }))
      };
    }

    case Role.treasurer:
    case Role.lga_admin:
    case Role.chairman: {
      // Management Cadre Overview (Whole LGA scope)
      const [revenueData, totalActivePermits, totalPendingInvoices, totalWards] = await Promise.all([
        prisma.invoice.aggregate({
          where: { status: InvoiceStatus.paid },
          _sum: { amountPaid: true }
        }),
        prisma.permit.count({
          where: { status: PermitStatus.issued }
        }),
        prisma.invoice.count({
          where: { status: InvoiceStatus.overdue }
        }),
        prisma.ward.count({
          where: { deletedAt: null }
        })
      ]);

      return {
        metrics: {
          totalRevenue: Number(revenueData._sum.amountPaid || 0),
          activePermits: totalActivePermits,
          overdueInvoices: totalPendingInvoices,
          wardCoverage: totalWards
        }
      };
    }

    case Role.ward_councillor: {
      // Councillor scope: restricted to their assigned ward
      const user = await prisma.user.findUnique({ 
        where: { id: userId }, 
        select: { wardId: true } 
      });

      if (!user?.wardId) throw new Error("Councillor not assigned to a ward.");

      const [pendingApps, wardComplaints] = await Promise.all([
        prisma.stateOfOriginApplication.count({
          where: { wardId: user.wardId, status: ApplicationStatus.forwarded_to_councillor }
        }),
        prisma.complaint.count({
          where: { wardId: user.wardId, status: ComplaintStatus.open }
        })
      ]);

      return {
        metrics: {
          pendingApprovals: pendingApps,
          wardComplaints: wardComplaints
        }
      };
    }

    case Role.contractor: {
      // Contractor scope: Metrics for their sub-agents and assigned invoices
      const [agentsCount, totalCollections] = await Promise.all([
        prisma.user.count({
          where: { contractorId: userId, role: Role.agent, isActive: true }
        }),
        prisma.invoice.aggregate({
          where: { createdBy: { contractorId: userId }, status: InvoiceStatus.paid },
          _sum: { amountPaid: true }
        })
      ]);

      return {
        metrics: {
          managedAgents: agentsCount,
          totalCollections: Number(totalCollections._sum.amountPaid || 0)
        }
      };
    }

    case Role.field_officer: {
      // Field Officer scope: Individual performance
      const [issuedInvoices, collectedAmount] = await Promise.all([
        prisma.invoice.count({
          where: { createdById: userId }
        }),
        prisma.invoice.aggregate({
          where: { createdById: userId, status: InvoiceStatus.paid },
          _sum: { amountPaid: true }
        })
      ]);

      return {
        metrics: {
          invoicesIssued: issuedInvoices,
          totalCollected: Number(collectedAmount._sum.amountPaid || 0)
        }
      };
    }

    default:
      return {
        message: "No specific metrics defined for this role.",
        metrics: {}
      };
  }
};

import { Request, Response, NextFunction } from 'express';
;

export const getDashboardOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Safely extract token payload properties
    const { id: userId, role } = (req as any).user as { id: string; role: Role };

    // Invoke our extracted service helper
    const payload = await fetchMetricsByRole(role, userId);

    res.status(200).json({
      success: true,
      role,
      ...payload
    });
  } catch (error: any) {
    // If our service threw a profile validation error, catch it gracefully
    if (error.message?.includes('missing')) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
 // Adjust to your auth file location

const router = Router();

// Protect endpoint with your standard access token decoding middleware
router.get('/overview', requireAuth, getDashboardOverview);

export default router;