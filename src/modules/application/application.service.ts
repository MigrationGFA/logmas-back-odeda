import { prisma } from '../../utils/prisma';
import { generateReceiptNumber } from '../../utils/generators';
import fs from 'fs';

type UploadedFileMeta = {
  originalName: string;
  fileName: string;
  relativePath: string; // path on disk, normalized with forward slashes
  url: string;
  documentType?: string | null;
  absolutePath?: string;
};

interface CreateAppParams {
  applicantId: string;
  serviceId: string;
  fullName: string;
  phone: string;
  email?: string | null;
  address: string;
  ward?: string | null;
  nin?: string | null;
  cacNumber?: string | null;
  formData: any;
}

export const createApplication = async (params: CreateAppParams & { files?: UploadedFileMeta[] }) => {
  const {
    applicantId,
    serviceId,
    fullName,
    phone,
    email,
    address,
    ward,
    nin,
    cacNumber,
    formData,
    files,
  } = params;

  // Transaction: create application and invoice atomically
  const result = await prisma.$transaction(async (tx) => {
    // 1. Verify service exists and is active
    const service = await tx.service.findUnique({ where: { id: serviceId }, include: { feeConfig: true } });
    if (!service) {
      const err: any = new Error('Service not found');
      err.statusCode = 404;
      err.code = 'SERVICE_NOT_FOUND';
      throw err;
    }
    if (!service.isActive) {
      const err: any = new Error('Service is not active');
      err.statusCode = 400;
      err.code = 'SERVICE_INACTIVE';
      throw err;
    }

    // 2. Resolve active fee config
    const feeConfig = await tx.serviceFeeConfig.findUnique({ where: { serviceId } });
    if (!feeConfig || feeConfig.status !== 'ACTIVE') {
      const err: any = new Error('Service fee not configured');
      err.statusCode = 400;
      err.code = 'SERVICE_FEE_NOT_CONFIGURED';
      throw err;
    }

    const feeAmount = feeConfig.amount;

    // 3. Create application
    const application = await tx.application.create({
      data: {
        applicationNumber: generateReceiptNumber('APP'),
        service: { connect: { id: serviceId } },
        applicant: { connect: { id: applicantId } },
        createdBy: { connect: { id: applicantId } },
        fullName,
        phone,
        email: email ?? null,
        address,
        ward: ward ?? null,
        nin: nin ?? null,
        cacNumber: cacNumber ?? null,
        feeAmount,
        formData,
        status: 'submitted',
      },
    });

    // 4. Create invoice referencing the application
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: generateReceiptNumber('INV'),
        applicationId: application.id,
        amount: feeAmount,
        paymentStatus: 'pending',
      },
    });

    // 5. Create ApplicationDocument records if files were provided
    if (files && files.length > 0) {
      for (const f of files) {
        await tx.applicationDocument.create({
          data: {
            applicationId: application.id,
            documentType: f.documentType ?? 'supporting_document',
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
    include: { service: true, invoice: true, certificate: true },
  });
  return app;
};

export const listApplicationsForUser = async (user: any, page = 1, limit = 25) => {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (user.role === 'citizen' || user.role === 'business_owner') {
    where.applicantId = user.id;
  }

  const items = await prisma.application.findMany({
    where,
    include: { service: true, invoice: true, certificate: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  const total = await prisma.application.count({ where });

  return { items, meta: { total, page, limit } };
};
