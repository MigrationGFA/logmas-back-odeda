import {
  Role,
  InvoiceStatus,
  PermitStatus,
  ApplicationStatus,
  ComplaintStatus,
  User,
} from "@prisma/client";
import { prisma } from "../../utils/prisma";

export const fetchMetricsByRole = async (role: Role, userId: string,user:User) => {
  switch (role) {
    case Role.citizen: {
      // 1. Fetch data associated with the user as an applicant or owner
      const [applications, _receipt, complaints, invoices] = await Promise.all([
        prisma.stateOfOriginApplication.findMany({
          where: { applicantId: userId },
          //   select: { status: true }
        }),
        prisma.receipt.count(),
        prisma.complaint.count({
          where: {
            raisedById: userId,
            status: { not: ComplaintStatus.closed },
          },
        }),
        prisma.invoice.findMany({
          where: {
            OR: [
              { createdById: userId }, // Direct system/self invoices
              { business: { ownerId: userId } }, // Business-related invoices
            ],
          },
        }),
      ]);

      // 2. Aggregate metrics for the UI
      const pendingInvoices = invoices.filter(
        (inv) => inv.status !== InvoiceStatus.paid,
      );
      const totalPendingAmount = pendingInvoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount),
        0,
      );
      const approvedApps = applications.filter(
        (a) => a.status === ApplicationStatus.approved,
      ).length;

      return {
        metrics: {
          pendingPayments: totalPendingAmount,
          approvedApplications: approvedApps,
          openComplaints: complaints,
          recentApplications: applications.slice(0, 5),
        },
      };
    }
    case Role.business_owner: {
      const [businesses, complaints, invoiceAgg, recentInvoices] =
        await Promise.all([
          // Active permits count
          prisma.permit.count({
            where: {
              business: { ownerId: userId },
              status: "issued",
            },
          }),

          // Open complaints
          prisma.complaint.count({
            where: { raisedById: userId, status: { not: "closed" } },
          }),

          // Revenue aggregates
          prisma.invoice.aggregate({
            where: {
              OR: [{ createdById: userId }, { business: { ownerId: userId } }],
            },
            _sum: { amountPaid: true, balanceDue: true, totalAmount: true },
            _count: { id: true },
          }),

          // Recent invoices for the table — shaped to match RecentInvoices component
          prisma.invoice.findMany({
            where: {
              OR: [{ createdById: userId }, { business: { ownerId: userId } }],
            },
            include: {
              business: { select: { businessName: true } },
              createdBy: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        ]);

      // Active notices = unpaid invoices count
      const activeNotices = await prisma.invoice.count({
        where: {
          OR: [{ createdById: userId }, { business: { ownerId: userId } }],
          status: { in: ["sent", "partially_paid", "overdue"] },
        },
      });

      return {
        metrics: {
          activeNotices,
          totalPaid: Number(invoiceAgg._sum.amountPaid ?? 0),
          outstanding: Number(invoiceAgg._sum.balanceDue ?? 0),
          activePermits: businesses,
          // openComplaints: complaints,
        },
        recentInvoices: recentInvoices.map((inv) => ({
          id: inv.id,
          reference: inv.invoiceNumber, // UI reads i.reference
          customerName:
            inv.business?.businessName ??
            `${inv.createdBy.firstName} ${inv.createdBy.lastName}`,
          amount: Number(inv.totalAmount), // UI reads i.amount
          status: inv.status, // UI reads i.status
        })),
      };
    }

    case Role.treasurer: {
      const currentYear = new Date().getFullYear();

      // 1. Fetch concurrent aggregations across domains
      const [
        revenueData,
        pendingData,
        activeOfficersCount,
        totalTransactionsCount,
        revenueByInvoiceGroup,
        monthlyRevenueRaw,
      ] = await Promise.all([
        // Total Revenue (Paid Invoices)
        prisma.invoice.aggregate({
          where: { status: InvoiceStatus.paid },
          _sum: { amountPaid: true },
        }),
        // Pending Amount (Unpaid Invoices)
        prisma.invoice.aggregate({
          where: { status: { in: ["sent", "overdue"] } },
          _sum: { totalAmount: true },
        }),
        // Count Active Revenue Officers
        prisma.user.count({
          where: {
            role: Role.field_officer,
            isActive: true,
          },
        }),
        // Total Transactions count
        prisma.invoice.count({
          where: { status: InvoiceStatus.paid },
        }),
        // Grouping by description/category fallback to isolate dynamic configurations
        prisma.invoice.groupBy({
          by: ["categoryId"],
          where: { status: InvoiceStatus.paid },
          _sum: { amountPaid: true },
          orderBy: {
            _sum: { amountPaid: "desc" },
          },
          take: 5,
        }),
        // Monthly distribution tracking for the trend chart line
        prisma.invoice.findMany({
          where: {
            status: InvoiceStatus.paid,
            createdAt: {
              gte: new Date(`${currentYear}-01-01`),
              lte: new Date(`${currentYear}-12-31`),
            },
          },
          select: {
            amountPaid: true,
            createdAt: true,
          },
        }),
      ]);

      // 2. Format 12-Month Revenue Trend Array (in Millions as expected by UI placeholder)
      const monthsLookup = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const chartData = monthsLookup.map((monthName, index) => {
        const monthlySum = monthlyRevenueRaw
          .filter((invoice) => new Date(invoice.createdAt).getMonth() === index)
          .reduce((sum, current) => sum + Number(current.amountPaid || 0), 0);

        // Scale to millions if match found, keep accurate native formatting
        const amountInMillions = Number((monthlySum / 1_000_000).toFixed(2));

        return {
          month: monthName,
          amount: amountInMillions > 0 ? amountInMillions : 0,
        };
      });

      // 3. Transform dynamic billing matrix category text for the progress distribution block
      const breakdownByCategory = revenueByInvoiceGroup.map((group) => ({
        category: group.categoryId,
        amount: Number(group._sum.amountPaid || 0),
      }));

      // 4. Dispatch payloads formatted specifically for your frontend components
      return {
        metrics: {
          totalRevenue: Number(revenueData._sum.amountPaid || 0),
          pendingAmount: Number(pendingData._sum.totalAmount || 0),
          activeOfficers: activeOfficersCount,
          transactionCount: totalTransactionsCount,
        },
        revenueTrendChart: chartData,
        categoryBreakdown: breakdownByCategory,
      };
    }
    case Role.lga_admin:
    case Role.chairman: {
      // Management Cadre Overview (Whole LGA scope)
      const [
        revenueData,
        totalActivePermits,
        totalPendingInvoices,
        totalWards,
      ] = await Promise.all([
        prisma.invoice.aggregate({
          where: { status: InvoiceStatus.paid },
          _sum: { amountPaid: true },
        }),
        prisma.permit.count({
          where: { status: PermitStatus.issued },
        }),
        prisma.invoice.count({
          where: { status: InvoiceStatus.overdue },
        }),
        prisma.ward.count({
          where: { deletedAt: null },
        }),
      ]);

      return {
        metrics: {
          totalRevenue: Number(revenueData._sum.amountPaid || 0),
          activePermits: totalActivePermits,
          overdueInvoices: totalPendingInvoices,
          wardCoverage: totalWards,
        },
      };
    }

    case Role.ward_councillor: {
      // Councillor scope: restricted to their assigned ward
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { wardId: true },
      });

      if (!user?.wardId) throw new Error("Councillor not assigned to a ward.");

      const [pendingApps, wardComplaints] = await Promise.all([
        prisma.stateOfOriginApplication.count({
          where: {
            wardId: user.wardId,
            status: ApplicationStatus.forwarded_to_councillor,
          },
        }),
        prisma.complaint.count({
          where: { wardId: user.wardId, status: ComplaintStatus.open },
        }),
      ]);

      return {
        metrics: {
          pendingApprovals: pendingApps,
          wardComplaints: wardComplaints,
        },
      };
    }

    case Role.contractor: {
      // Contractor scope: Metrics for their sub-agents and assigned invoices
      const [agentsCount, totalCollections] = await Promise.all([
        prisma.user.count({
          where: { contractorId: userId, role: Role.agent, isActive: true },
        }),
        prisma.invoice.aggregate({
          where: {
            createdBy: { contractorId: userId },
            status: InvoiceStatus.paid,
          },
          _sum: { amountPaid: true },
        }),
      ]);

      return {
        metrics: {
          managedAgents: agentsCount,
          totalCollections: Number(totalCollections._sum.amountPaid || 0),
        },
      };
    }

    case Role.field_officer: {
      // Enforce strict geographic fallback checks
      if (!user.wardId) {
        throw new Error(
          "Field Officer must have an assigned wardId to load metrics.",
        );
      }

      // Execute efficient data sweeps across invoices, payments, and receipts in parallel
      const [invoicesInWard, paymentsInWard, recentInvoicesRaw] =
        await Promise.all([
          // 1. Fetch total context mapping of invoices inside this ward
          prisma.invoice.findMany({
            where: {
              business: {
                wardId: user.wardId,
              },
              status: { not: "cancelled" },
            },
            select: {
              id: true,
              status: true,
              totalAmount: true,
            },
          }),

          // 2. Scan confirmed payments impacting this ward to calculate payment channel splits
          prisma.payment.findMany({
            where: {
              status: "confirmed",
              invoice: {
                business: {
                  wardId: user.wardId,
                },
              },
            },
            select: {
              amount: true,
              method: true,
            },
          }),

          // 3. Pull recent invoice data for the RecentInvoices feed component array
          prisma.invoice.findMany({
            where: {
              business: {
                wardId: user.wardId,
              },
            },
            take: 5,
            orderBy: {
              createdAt: "desc",
            },
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              status: true,
              business: {
                select: {
                  businessName: true,
                  ownerName: true,
                },
              },
            },
          }),
        ]);

      // 4. Reduce Row 1 Metrics: Status & Total Volumes
      const totalInvoicesGenerated = invoicesInWard.length;
      let pendingCount = 0;
      let overdueCount = 0;

      invoicesInWard.forEach((inv) => {
        // UI expects "unpaid" to match unpaid/sent status maps
        if (inv.status === "draft" || inv.status === "sent") {
          pendingCount++;
        } else if (inv.status === "overdue") {
          overdueCount++;
        }
      });

      // 5. Reduce Row 2 Metrics: Dynamic Payment Method Channels
      let totalCollected = 0;
      let cashTotal = 0;
      let posTotal = 0;
      let onlineTotal = 0;
      let transferTotal = 0;

      paymentsInWard.forEach((pay) => {
        const amt = Number(pay.amount || 0);
        totalCollected += amt;

        switch (pay.method) {
          case "cash":
            cashTotal += amt;
            break;
          case "pos":
            posTotal += amt;
            break;
          case "online_gateway":
            onlineTotal += amt;
            break;
          case "bank_transfer":
          case "virtual_account":
            transferTotal += amt;
            break;
          default:
            break;
        }
      });

      // 6. Map Recent Invoices precisely to match the RecentInvoiceItem frontend contract
      const formattedRecentInvoices = recentInvoicesRaw.map((inv) => ({
        id: inv.id,
        reference: inv.invoiceNumber,
        customerName:
          inv.business?.businessName ||
          inv.business?.ownerName ||
          "Walk-in Taxpayer",
        amount: Number(inv.totalAmount || 0),
        status:
          inv.status === "draft" || inv.status === "sent"
            ? "unpaid"
            : inv.status, // Normalizing status strings
      }));

      // Return formatted response structure
      return {
        metrics: {
          totalInvoicesGenerated,
          totalCollected,
          pendingCount,
          overdueCount,
          channelBreakdown: {
            cash: cashTotal,
            pos: posTotal,
            online: onlineTotal,
            transfer: transferTotal,
          },
        },
        recentInvoices: formattedRecentInvoices,
      };
    }

    default:
      return {
        message: "No specific metrics defined for this role.",
        metrics: {},
      };
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
    const payload = await fetchMetricsByRole(role, userId,user);

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
