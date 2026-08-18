import { InvoiceStatus, Role, Prisma, PaymentMethod } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import { prisma } from "../../utils/prisma";
import { sendError, sendSuccess } from "../../utils/response";
import {
  generateQrToken,
  generateReceiptNumber,
  generateReference,
  generateVerificationCode,
} from "../../utils/generators";
import { getIp } from "../complaints/complaints.controller";
import { confirmPayment } from "../payment/payment.service";

interface GetInvoicesQuery {
  role: Role;
  userId: string;
  tab?: string;
  search?: string;
}

export const fetchInvoicesHubData = async ({
  role,
  userId,
  tab,
  search,
}: GetInvoicesQuery) => {
  const where: Prisma.InvoiceWhereInput = {};

  // ---------------------------------------------------------
  // Access control
  // ---------------------------------------------------------
  if (role === Role.citizen || role === Role.business_owner) {
    where.application = {
      applicantId: userId,
    };
  } else if (role === Role.field_officer) {
    where.createdById = userId;
  }

  // ---------------------------------------------------------
  // Search
  // ---------------------------------------------------------
  if (search?.trim()) {
    const value = search.trim();

    where.OR = [
      {
        invoiceNumber: {
          contains: value,
          mode: "insensitive",
        },
      },
      {
        application: {
          applicationNumber: {
            contains: value,
            mode: "insensitive",
          },
        },
      },
      {
        application: {
          service: {
            name: {
              contains: value,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  // ---------------------------------------------------------
  // Payment status filter
  // ---------------------------------------------------------
  if (tab && tab !== "all") {
    if (tab === "unpaid") {
      where.paymentStatus = {
        in: ["pending"],
      };
    } else {
      where.paymentStatus = tab;
    }
  }

  // ---------------------------------------------------------
  // Fetch invoices
  // ---------------------------------------------------------
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      application: {
        select: {
          id: true,
          applicationNumber: true,
          applicantId: true,
          service: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
            },
          },
        },
      },

      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
        },
      },

      receipts: {
        select: {
          id: true,
          receiptNumber: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  // ---------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------
  const totalCollected = invoices.reduce((sum, invoice) => {
    const paid = invoice.payments
      .filter((payment) => payment.status === "confirmed")
      .reduce(
        (paymentSum, payment) =>
          paymentSum + Number(payment.amount),
        0,
      );

    return sum + paid;
  }, 0);

  const outstanding = invoices.reduce((sum, invoice) => {
    const paid = invoice.payments
      .filter((payment) => payment.status === "confirmed")
      .reduce(
        (paymentSum, payment) =>
          paymentSum + Number(payment.amount),
        0,
      );

    return sum + Math.max(Number(invoice.amount) - paid, 0);
  }, 0);

  const transactions = invoices.reduce(
    (count, invoice) => count + invoice.receipts.length,
    0,
  );

  const avgPayment =
    transactions > 0
      ? Math.round(totalCollected / transactions)
      : 0;

  // ---------------------------------------------------------
  // Return
  // ---------------------------------------------------------
  return {
    stats: {
      outstanding,
      totalCollected,
      transactions,
      avgPayment,
    },

    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      reference: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      paymentStatus: invoice.paymentStatus,
      dueDate: invoice.dueDate
        ? invoice.dueDate.toISOString().split("T")[0]
        : null,

      application: invoice.application
        ? {
            id: invoice.application.id,
            applicationNumber: invoice.application.applicationNumber,
            applicantId: invoice.application.applicantId,
          }
        : null,

      service: invoice.application?.service
        ? {
            id: invoice.application.service.id,
            code: invoice.application.service.code,
            name: invoice.application.service.name,
            category: invoice.application.service.category,
          }
        : null,

      receipts: invoice.receipts,
    })),
  };
};

/**
 * @desc    Get Invoices Ledger List and Stats Overview in a single batch query
 * @route   GET /api/v1/invoices/hub
 * @access  Authenticated
 */
export const getInvoicesHubOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: userId, role } = (req as any).user as {
      id: string;
      role: Role;
    };
    const { tab, search } = req.query as { tab?: string; search?: string };

    const payload = await fetchInvoicesHubData({
      role,
      userId,
      tab,
      search,
    });

    res.status(200).json({
      success: true,
      ...payload,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/invoices/:id
export const getInvoiceById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user!;

    const invoice = await prisma.invoice.findUnique({
      where: {
        invoiceNumber: String(id),
      },
      include: {
        application: {
          select: {
            id: true,
            applicationNumber: true,
            applicantId: true,
            service: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
        receipts: {
          orderBy: {
            issuedAt: "desc",
          },
        },
      },
    });

    if (!invoice) {
      return sendError(
        res,
        "Invoice not found",
        "NOT_FOUND",
        null,
        404,
      );
    }


    return sendSuccess(res, invoice);
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/invoices/:id/pay

export const recordInvoicePayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;
    const { method, amount, reference, narration } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: String(id) },
    });
    if (!invoice)
      return sendError(res, "Invoice not found", "NOT_FOUND", null, 404);

    if (["paid", "cancelled"].includes(invoice.status)) {
      return sendError(
        res,
        "Invoice is already paid or cancelled",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // Cash/POS only — online payments go through /pay-online now, not this route.
    if (!["field_officer", "lga_admin", "super_admin"].includes(role)) {
      return sendError(
        res,
        "Only field officers can record cash or POS payments",
        "FORBIDDEN",
        null,
        403,
      );
    }

    const paymentAmount = Number(amount ?? invoice.balanceDue);

    const result = await confirmPayment({
      invoiceId: invoice.id,
      amount: paymentAmount,
      method,
      reference,
      narration,
      paidById: invoice.createdById,
      confirmedById: userId,
    });

    await prisma.auditLog.create({
      data: {
        action: "payment_confirmed",
        entity: "Payment",
        entityId: result.payment.id,
        user: { connect: { id: userId } },
        details: {
          invoiceId: id,
          amount: paymentAmount,
          method,
          isFullPayment: result.isFullPayment,
        },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(
      res,
      {
        payment: result.payment,
        invoice: result.invoice,
        receipt: result.receipt,
        isFullPayment: result.isFullPayment,
        message: result.isFullPayment
          ? "Payment confirmed. Receipt generated."
          : `Partial payment recorded. Balance due: ₦${Number(result.invoice.balanceDue)}`,
      },
      result.isFullPayment ? "Payment complete" : "Partial payment recorded",
    );
  } catch (err) {
    next(err);
  }
};


