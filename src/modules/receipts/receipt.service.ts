// import { Role, Prisma } from "@prisma/client";
// import { prisma } from "../../utils/prisma";
// import { sendError } from "../../utils/response";

// interface GetReceiptsQuery {
//   role: Role;
//   userId: string;
// }

// export const fetchAllUserReceipts = async ({
//   role,
//   userId,
// }: GetReceiptsQuery) => {
//   const baseWhere: Prisma.ReceiptWhereInput = {};

//   // Role-Based Isolation Filters
//   if (role === Role.citizen || role === Role.business_owner) {
//     baseWhere.invoice = {
//       OR: [
//         { application: { applicantId: userId } },
//         { application: { createdById: userId } },
//       ],
//     };
//   } else if (role === Role.field_officer) {
//     baseWhere.invoice = { application: { createdById: userId } };
//   } else if (role === Role.agent) {
//     // 🚀 Agents see receipts created by themselves OR by field officers under their supervision
//     baseWhere.invoice = {
//       createdBy: {
//         OR: [
//           { id: userId },
//           { agentId: userId }
//         ]
//       }
//     };
//   } else if (role === Role.contractor) {
//     // 🚀 Contractors see all receipts across their entire sub-agent and field officer tree
//     baseWhere.invoice = {
//       createdBy: { contractorId: userId }
//     };
//   }

//   const receipts = await prisma.receipt.findMany({
//     where: baseWhere,
//     include: {
//       invoice: {
//         include: {
//           application: {
//             include: { applicant: { select: { id: true, firstName: true, lastName: true } }, service: { select: { name: true } } },
//           },
//           createdBy: { select: { firstName: true, lastName: true, phone: true } },
//           payments: {
//             where: { status: 'confirmed' },
//             orderBy: { createdAt: 'desc' },
//             take: 1,
//             select: { method: true },
//           },
//         },
//       },
//     },
//     orderBy: { issuedAt: "desc" },
//   });

//   // Map to align with the frontend useStore keys perfectly
//   const allReceipts = receipts.map((r) => {
//     const customerName =
//       r.invoice.application?.fullName ??
//       `${r.invoice.application?.applicant?.firstName || ''} ${r.invoice.application?.applicant?.lastName || ''}`.trim() ||
//       `${r.invoice.createdBy?.firstName || ''} ${r.invoice.createdBy?.lastName || ''}`.trim();
//     return {
//       id: r.id,
//       receiptNumber: r.receiptNumber,
//       amount: Number(r.amountPaid),
//       customerName,
//       levyType: r.invoice.application?.service?.name || 'Local Revenue Item',
//       paidAt: r.issuedAt.toISOString(),
//       paymentMethod: r.invoice.payments?.[0]?.method ?? "online",
//       invoiceId: r.invoiceId,
//     };
//   });

//   return {
//     data: allReceipts
//   };
// };

// export const fetchReceiptByIdentifier = async (
//   idOrNumber: string,
//   role: Role,
//   userId: string,
// ) => {
//   const receipt = await prisma.receipt.findFirst({
//     where: {
//       OR: [{ id: idOrNumber }, { receiptNumber: idOrNumber }],
//     },
//     include: {
//       invoice: {
//         include: {
//           application: { include: { applicant: true, service: true } },
//           createdBy: true,
//           assignedOfficer: true,
//           payments: { where: { status: 'confirmed' }, orderBy: { createdAt: 'desc' }, take: 1, select: { method: true } },
//         },
//       },
//     },
//   });

//   if (!receipt) return null;


  
//   // Authorization Shield — add field_officer scope
//   if (role === Role.citizen || role === Role.business_owner) {
//     const isOwner =
//       receipt.invoice.application?.applicantId === userId ||
//       receipt.invoice.application?.createdById === userId;
//     if (!isOwner) return null;
//   } else if (role === Role.field_officer) {
//     // Officer can only see receipts from invoices for applications they created
//     if (receipt.invoice.application?.createdById !== userId) {
//       throw Error('Field Officers can only see receipts from invoices they created');
//     }
//   }

//   const customerName =
//     receipt.invoice.application?.fullName ??
//     `${receipt.invoice.application?.applicant?.firstName || ''} ${receipt.invoice.application?.applicant?.lastName || ''}`.trim() ||
//     `${receipt.invoice.createdBy?.firstName || ''} ${receipt.invoice.createdBy?.lastName || ''}`.trim();

//   return {
//     id: receipt.id,
//     receiptNumber: receipt.receiptNumber,
//     verificationCode: receipt.verificationCode,
//     invoiceRef: receipt.invoice.invoiceNumber,
//     invoiceId: receipt.invoiceId,
//     paymentMethod: receipt.invoice.payments?.[0]?.method ?? 'online',
//     amount: Number(receipt.amountPaid),
//     paidAt: receipt.issuedAt.toISOString(),
//     customerName,
//     phone: receipt.invoice.createdBy?.phone ?? 'N/A',
//     levyType: receipt.invoice.application?.service?.name ?? 'Local Revenue Item',
//     officerName: receipt.invoice.assignedOfficer
//       ? `${receipt.invoice.assignedOfficer.firstName} ${receipt.invoice.assignedOfficer.lastName}`
//       : null,
//     invoice: { address: receipt.invoice.application?.address || '' },
//   };
// };
