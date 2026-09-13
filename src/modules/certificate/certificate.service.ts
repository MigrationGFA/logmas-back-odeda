import { Role, Prisma } from "@prisma/client";
import { prisma } from "../../utils/prisma";

interface GetCertificatesQuery {
  role: Role;
  userId: string;
}

const certificateListSelect = {
  id: true,
  certificateNumber: true,
  verificationCode: true,
  qrToken: true,
  issuedAt: true,
  expiresAt: true,
  pdfUrl: true,
  issuedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
  application: {
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      feeAmount: true,
      formData: true,
      createdAt: true,
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
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      service: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          revenueHead: true,
          description: true,
          certificateType: true,
          estimatedDays: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          paymentStatus: true,
          paidAt: true,
        },
      },
    },
  },
} satisfies Prisma.CertificateSelect;

const mapCertificate = (
  certificate: Prisma.CertificateGetPayload<{ select: typeof certificateListSelect }>,
) => {
  const { application } = certificate;

  return {
    id: certificate.id,
    certificateNumber: certificate.certificateNumber,
    verificationCode: certificate.verificationCode,
    qrToken: certificate.qrToken,
    issuedAt: certificate.issuedAt.toISOString(),
    expiresAt: certificate.expiresAt ? certificate.expiresAt.toISOString() : null,
    pdfUrl: certificate.pdfUrl,
    issuedBy: certificate.issuedBy
      ? {
          id: certificate.issuedBy.id,
          name: `${certificate.issuedBy.firstName} ${certificate.issuedBy.lastName}`,
          role: certificate.issuedBy.role,
        }
      : null,
    application: {
      id: application.id,
      applicationNumber: application.applicationNumber,
      status: application.status,
      feeAmount: Number(application.feeAmount),
      formData: application.formData,
      createdAt: application.createdAt.toISOString(),
      applicant: application.applicant
        ? {
            id: application.applicant.id,
            name: `${application.applicant.firstName} ${application.applicant.lastName}`,
            email: application.applicant.email,
            phone: application.applicant.phone,
          }
        : null,
      createdBy: application.createdBy
        ? {
            id: application.createdBy.id,
            name: `${application.createdBy.firstName} ${application.createdBy.lastName}`,
          }
        : null,
    },
    service: {
      id: application.service.id,
      code: application.service.code,
      name: application.service.name,
      category: application.service.category,
      revenueHead: application.service.revenueHead,
      description: application.service.description,
      certificateType: application.service.certificateType,
      estimatedDays: application.service.estimatedDays,
    },
    invoice: application.invoice
      ? {
          id: application.invoice.id,
          invoiceNumber: application.invoice.invoiceNumber,
          amount: Number(application.invoice.amount),
          paymentStatus: application.invoice.paymentStatus,
          paidAt: application.invoice.paidAt
            ? application.invoice.paidAt.toISOString()
            : null,
        }
      : null,
  };
};

export const fetchAllUserCertificates = async ({
  role,
  userId,
}: GetCertificatesQuery) => {
  const baseWhere: Prisma.CertificateWhereInput = {};

  // Role-Based Isolation Filters — mirrors receipt.service.ts convention
  if (role === Role.citizen || role === Role.business_owner) {
    baseWhere.application = {
      OR: [{ applicantId: userId }, { createdById: userId }],
    };
  } else if (role === Role.field_officer) {
    baseWhere.application = { createdById: userId };
  }

  const certificates = await prisma.certificate.findMany({
    where: baseWhere,
    select: certificateListSelect,
    orderBy: { issuedAt: "desc" },
  });

  return certificates.map(mapCertificate);
};

export const fetchCertificateByIdentifier = async (
  idOrNumber: string,
  role: Role,
  userId: string,
) => {
  const certificate = await prisma.certificate.findFirst({
    where: {
      OR: [
        { id: idOrNumber },
        { certificateNumber: idOrNumber },
        { verificationCode: idOrNumber },
      ],
    },
    select: certificateListSelect,
  });

  if (!certificate) return null;

  // Authorization Shield — mirrors receipt.service.ts convention
  if (role === Role.citizen || role === Role.business_owner) {
    const isOwner =
      certificate.application.applicant?.id === userId ||
      certificate.application.createdBy?.id === userId;
    if (!isOwner) return null;
  } else if (role === Role.field_officer) {
    if (certificate.application.createdBy?.id !== userId) {
      throw Error(
        "Field Officers can only see certificates from applications they created",
      );
    }
  }

  return mapCertificate(certificate);
};
