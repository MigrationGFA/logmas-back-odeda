import { Role, Prisma } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { sendError } from "../../utils/response";

interface GetReceiptsQuery {
  role: Role;
  userId: string;
}

export const fetchAllUserReceipts = async ({
  role,
  userId,
}: GetReceiptsQuery) => {
  const baseWhere: Prisma.ReceiptWhereInput = {};

  // Role-Based Isolation Filters
  if (role === Role.citizen || role === Role.business_owner) {
    baseWhere.invoice = {
      OR: [
        { application: { applicantId: userId } },
        { application: { createdById: userId } },
      ],
    };
  } else if (role === Role.field_officer) {
    baseWhere.invoice = { application: { createdById: userId } };
  }

  const receipts = await prisma.receipt.findMany({
    where: baseWhere,
    include: {
      invoice: {
        include: {
          application: {
            include: {
              applicant: {
                select: { id: true, firstName: true, lastName: true },
              },
              service: { select: { name: true } },
            },
          },
          createdBy: {
            select: { firstName: true, lastName: true, phone: true },
          },
          payments: {
            where: { status: "confirmed" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { method: true },
          },
        },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  // Map to align with the frontend useStore keys perfectly
  const allReceipts = receipts.map((r) => {
    return {
      id: r.id,
      receiptNumber: r.receiptNumber,
      amount: Number(r.amountPaid),
      serviceName: r.invoice.application?.service?.name || "Local Revenue Item",
      paidAt: r.issuedAt.toISOString(),
      paymentMethod: r.invoice.payments?.[0]?.method ?? "online",
      invoiceId: r.invoiceId,
    };
  });

  return allReceipts;
};

export const fetchReceiptByIdentifier = async (
  idOrNumber: string,
  role: Role,
  userId: string,
) => {
  const receipt = await prisma.receipt.findFirst({
    where: {
      OR: [{ id: idOrNumber }, { receiptNumber: idOrNumber }],
    },
    include: {
      invoice: {
        include: {
          application: { include: { applicant: true, service: true } },
          createdBy: true,
          assignedOfficer: true,
          payments: {
            where: { status: "confirmed" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { method: true },
          },
        },
      },
    },
  });

  if (!receipt) return null;

  // Authorization Shield — add field_officer scope
  if (role === Role.citizen || role === Role.business_owner) {
    const isOwner =
      receipt.invoice.application?.applicantId === userId ||
      receipt.invoice.application?.createdById === userId;
    if (!isOwner) return null;
  } else if (role === Role.field_officer) {
    // Officer can only see receipts from invoices for applications they created
    if (receipt.invoice.application?.createdById !== userId) {
      throw Error(
        "Field Officers can only see receipts from invoices they created",
      );
    }
  }


  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    verificationCode: receipt.verificationCode,
    invoiceRef: receipt.invoice.invoiceNumber,
    invoiceId: receipt.invoiceId,
    paymentMethod: receipt.invoice.payments?.[0]?.method ?? "online",
    amount: Number(receipt.amountPaid),
    paidAt: receipt.issuedAt.toISOString(),
    phone: receipt.invoice.createdBy?.phone ?? "N/A",
    serviceName:
      receipt.invoice.application?.service?.name ?? "Local Revenue Item",
    officerName: receipt.invoice.assignedOfficer
      ? `${receipt.invoice.assignedOfficer.firstName} ${receipt.invoice.assignedOfficer.lastName}`
      : null,
    // invoice: { address: receipt.invoice.application?.address || "" },
  };
};
