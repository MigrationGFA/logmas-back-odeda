import { prisma } from "../../utils/prisma";
import { generateReceiptNumber } from "../../utils/generators";
import fs from "fs";
import { notify } from "../notification/notification.service";

type UploadedFileMeta = {
  originalName: string;
  fileName: string;
  relativePath: string; // path on disk, normalized with forward slashes
  url: string;
  documentType?: string | null;
  absolutePath?: string;
};

interface CreateAppParams {
  applicantId?: string | null;
  createdById?: string | null;
  serviceId: string;
  formData: unknown;
  createInvoice?: boolean;
}

export const createApplication = async (
  params: CreateAppParams & { files?: UploadedFileMeta[] },
) => {
  const {
    applicantId,
    serviceId,
    formData,
    files,
    createdById,
    createInvoice = true,
  } = params;

  // Transaction: create application and invoice atomically
  const result = await prisma.$transaction(async (tx) => {
    // 1. Verify service exists and is active
    const service = await tx.service.findUnique({
      where: { id: serviceId },
      include: { feeConfig: true },
    });
    if (!service) {
      const err: any = new Error("Service not found");
      err.statusCode = 404;
      err.code = "SERVICE_NOT_FOUND";
      throw err;
    }
    if (!service.isActive) {
      const err: any = new Error("Service is not active");
      err.statusCode = 400;
      err.code = "SERVICE_INACTIVE";
      throw err;
    }

    // 2. Resolve active fee config
    const feeConfig = await tx.serviceFeeConfig.findUnique({
      where: { serviceId },
    });
    if (!feeConfig || feeConfig.status !== "ACTIVE") {
      const err: any = new Error("Service fee not configured");
      err.statusCode = 400;
      err.code = "SERVICE_FEE_NOT_CONFIGURED";
      throw err;
    }

    const feeAmount = feeConfig.amount;

    // 3. Create application
    const createData: any = {
      applicationNumber: generateReceiptNumber("APP"),
      service: { connect: { id: serviceId } },
      feeAmount,
      formData,
      status: "submitted",
    };

    if (applicantId) {
      createData.applicant = { connect: { id: applicantId } };
    }
    if (createdById) {
      createData.createdBy = { connect: { id: createdById } };
    } else if (applicantId) {
      // fallback: if no explicit createdBy provided, use applicant as creator
      createData.createdBy = { connect: { id: applicantId } };
    }

    const application = await tx.application.create({
      data: createData,
      include: {
        service: true,
        applicant: true,
      },
    });

    let invoice = null;
    // 4. Create invoice referencing the application
    if (createInvoice) {
      const invoiceCreatorId = createdById || applicantId;

      invoice = await tx.invoice.create({
        data: {
          invoiceNumber: generateReceiptNumber("INV"),
          application: { connect: { id: application.id } }, // changed from applicationId
          service: { connect: { id: serviceId } },
          amount: feeAmount,
          paymentStatus: "pending",
          ...(invoiceCreatorId
            ? {
                createdBy: { connect: { id: invoiceCreatorId } },
              }
            : {}),
        },
      });
    }
    if (!files) {
      const err: any = new Error("Files not uploaded");
      err.statusCode = 400;
      err.code = "FILES_NOT_UPLOADED";
      throw err;
    }

    // 5. Create ApplicationDocument records if files were provided
    if (files && files.length > 0) {
      for (const f of files) {
        await tx.applicationDocument.create({
          data: {
            applicationId: application.id,
            documentType: f.documentType ?? "supporting_document",
            originalName: f.originalName,
            fileName: f.fileName,
            url: f.url,
          },
        });
      }
    }

    return { application, invoice };
  });

  return result;
};

export const getApplicationByIdOrNumber = async (idOrNumber: string) => {
  const app = await prisma.application.findFirst({
    where: { OR: [{ id: idOrNumber }, { applicationNumber: idOrNumber }] },
    include: {
      service: true,
      invoice: true,
      certificate: true,
      applicationDocuments: true,
      applicant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  });
  return app;
};

// export const listApplicationsForUser = async (
//   user: any,
//   page = 1,
//   limit = 25,
// ) => {
//   const skip = (page - 1) * limit;
//   const where: any = {};

//   if (user.role === "citizen" || user.role === "business_owner") {
//     where.applicantId = user.id;
//   } else if (user.role === "field_officer") {
//     // Field officers see applications they created
//     where.createdById = user.id;
//   }

//   const items = await prisma.application.findMany({
//     where,
//     include: {
//       service: true,
//       invoice: true,
//       certificate: true,
//       applicationDocuments: true,
//       applicant:true
//     },
//     orderBy: { createdAt: "desc" },
//     skip,
//     take: limit,
//   });

//   const total = await prisma.application.count({ where });

//   return { items, meta: { total, page, limit } };
// };


export const listApplicationsForUser = async (
  user: any,
  page = 1,
  limit = 25,
) => {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (user.role === "citizen" || user.role === "business_owner") {
    where.applicantId = user.id;
  } else if (user.role === "field_officer") {
    where.createdById = user.id;
  }
  // For privileged roles (super_admin, lga_admin, etc.) - no restrictions

  const items = await prisma.application.findMany({
    where,
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      feeAmount: true,
      formData: true,
      paymentFirst: true,
      createdAt: true,
      updatedAt: true,
      reviewedAt: true,
      declineReason: true,
      serviceId: true,
      applicantId: true,
      createdById: true,
      reviewedById: true,
      service: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          revenueHead: true,
          description: true,
          estimatedDays: true,
          certificateType: true,
          isActive: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          paymentStatus: true,
          paidAt: true,
          transactionRef: true,
          virtualAccountNumber: true,
          virtualBankName: true,
          payments: {
            select:{
              method:true
            }
          }
        },
      },
      certificate: {
        select: {
          id: true,
          certificateNumber: true,
          verificationCode:true,
          issuedAt: true,
          expiresAt: true,
          pdfUrl: true,
          issuedBy:true
        },
      },
      applicationDocuments: {
        select: {
          id: true,
          documentType: true,
          originalName: true,
          fileName: true,
          url: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
        },
        orderBy: {
          uploadedAt: "desc",
        },
        take: 10, // Limit to most recent 10 documents
      },
      applicant: {
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          address: true,
          town: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  const total = await prisma.application.count({ where });


  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};