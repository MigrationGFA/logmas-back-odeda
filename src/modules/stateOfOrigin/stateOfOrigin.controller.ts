// src/modules/stateOfOrigin/stateOfOrigin.controller.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../../utils/prisma";
import { sendSuccess, sendError } from "../../utils/response";
import {
  generateReceiptNumber,
  generateVerificationCode,
  generateQrToken,
} from "../../utils/generators";
import { ApplicationStatus } from "@prisma/client";
import { getIp, queryString } from "../complaints/complaints.controller";
import { sendEmail } from "../notification/email.service";
import {
  interpolate,
  NotificationTemplates,
} from "../../config/notification.template";
import { notify } from "../notification/notification.service";

// ─────────────────────────────────────────────────────────────
// CITIZEN
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/state-of-origin
 * Citizen submits a new application.
 * Creates the application + a draft invoice automatically.
 */
export const submitApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const citizenId = req.user!.id;
    const {
      fullName,
      dateOfBirth,
      gender,
      address,
      phone,
      email,
      wardId,
      purpose,
      nin,
      passportUrl,
    } = req.body;

    // Prevent duplicate pending applications
    // const existing = await prisma.stateOfOriginApplication.findFirst({
    //   where: {
    //     applicantId: citizenId,
    //     status: { notIn: ['rejected', 'certificate_issued'] },
    //     // deletedAt: null,
    //   },
    // });
    // if (existing) {
    //   return sendError(
    //     res,
    //     'You already have an active State of Origin application',
    //     'CONFLICT',
    //     null,
    //     409
    //   );
    // }

    // Verify ward exists
    // const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    // if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);

    const stateOfOriginCategory = await prisma.revenueCategory.findUnique({
      where: { slug: "state_of_origin_fee" },
    });

    if (!stateOfOriginCategory) {
      return sendError(
        res,
        "State of Origin fee category not configured. Contact the administrator.",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // Then fetch the levy config using the real UUID
    const levyConfig = await prisma.levyConfig.findFirst({
      where: { categoryId: stateOfOriginCategory.id, isActive: true },
    });
    // Create application + invoice in one transaction
    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.stateOfOriginApplication.create({
        data: {
          fullName,
          dateOfBirth: new Date(dateOfBirth),
          gender,
          address,
          phone,
          email,
          // wardId,
          purpose,
          nin,
          passportUrl,
          applicant: { connect: { id: citizenId } },
          status: "submitted",
        },
      });

      const totalAmount = levyConfig?.amount ?? 5000; // fallback if treasurer hasn't configured yet

      const invoice = await tx.invoice.create({
        data: {
          categoryId: stateOfOriginCategory.id,
          description: `State of Origin Application — ${fullName}`,
          subtotal: totalAmount,
          totalAmount,
          balanceDue: totalAmount,
          status: "sent",
          levyConfigId: levyConfig?.id,
          createdById: citizenId,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // Link invoice to application
      const updatedApplication = await tx.stateOfOriginApplication.update({
        where: { id: application.id },
        data: { invoiceId: invoice.id, status: "payment_pending" },
        include: { ward: true, invoice: true },
      });

      return updatedApplication;
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "application_submitted",
        entity: "StateOfOriginApplication",
        entityId: result.id,
        userId: citizenId,
        ipAddress: req.ip,
      },
    });

    try {
      await notify({
        userId: citizenId,
        to: { phone: result.phone, email: result.email },
        templateKey: "soo.invoiceGenerated",
        vars: {
          applicant_name: result.fullName,
          application_id: result.id,
          invoice_number: result.invoice?.id,
          payment_amount: `₦${result.invoice?.totalAmount.toLocaleString()}`,
        },
        channels: ["sms", "email"],
      });
    } catch (notifyErr) {
      console.error(
        "[submitApplication] notify() failed, continuing anyway:",
        notifyErr,
      );
    }
    return sendSuccess(
      res,
      result,
      "Application submitted successfully. Please proceed to payment.",
      201,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/state-of-origin/my
 * Citizen views their own applications.
 */
export const getMyApplications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const citizenId = req.user!.id;

    const applications = await prisma.stateOfOriginApplication.findMany({
      where: { applicantId: citizenId },
      include: {
        // ward: { select: { id: true, name: true, code: true } },
        invoice: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            balanceDue: true,
          },
        },
        certificate: {
          select: { id: true, certificateNumber: true, issuedAt: true },
        },
        assignedCouncillor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(res, { data: applications });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/state-of-origin/my/:id
 * Citizen views a specific application.
 */
export const getMyApplicationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    const citizenId = req.user!.id;
    if (Array.isArray(id)) id = id[0];

    const application = await prisma.stateOfOriginApplication.findFirst({
      where: { id, applicantId: citizenId }, // ownership enforced here
      include: {
        ward: true,
        invoice: true,
        certificate: true,
      },
    });

    if (!application)
      return sendError(res, "Application not found", "NOT_FOUND", null, 404);

    return sendSuccess(res, application);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// LGA ADMIN — Review & Forward
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/state-of-origin/admin
 * LGA Admin views all applications with filters.
 */
export const getAllApplications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const status = queryString(req.query.status);
    const wardId = queryString(req.query.wardId);
    const search = queryString(req.query.search);
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "10");
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (wardId) where.wardId = wardId;

    // Search by applicant name or application number
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { applicationNo: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const [applications, total] = await Promise.all([
      prisma.stateOfOriginApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          applicant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          ward: { select: { id: true, name: true, code: true } },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              totalAmount: true,
              balanceDue: true,
            },
          },
          certificate: {
            select: { id: true, certificateNumber: true, issuedAt: true },
          },
          // Include assigned councillor so admin can see who it's been forwarded to
          assignedCouncillor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              assignedWard: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.stateOfOriginApplication.count({ where }),
    ]);

    return sendSuccess(res, {
      data: applications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/state-of-origin/admin/:id
 * LGA Admin views a single application in full detail.
 */
export const getApplicationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const application = await prisma.stateOfOriginApplication.findUnique({
      where: { id },
      include: {
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        ward: true,
        invoice: true,
        certificate: true,
      },
    });

    if (!application)
      return sendError(res, "Application not found", "NOT_FOUND", null, 404);

    return sendSuccess(res, application);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/state-of-origin/admin/:id/forward
 * LGA Admin reviews and forwards to Ward Councillor.
 * Only allowed if application is in 'paid' status.
 */
// PATCH /api/v1/state-of-origin/admin/:id/forward
export const forwardToCouncillor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { reviewNotes, councillorId } = req.body; // councillorId is now optional

    const application = await prisma.stateOfOriginApplication.findUnique({
      where: { id: String(id) },
      include: { invoice: true, ward: true },
    });

    if (!application)
      return sendError(res, "Application not found", "NOT_FOUND", null, 404);

    if (application.status !== "paid") {
      return sendError(
        res,
        "Only paid applications can be forwarded",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // If LGA Admin specified a councillor — use them
    // If not — fall back to ward-based routing
    let targetCouncillorId: string | null = null;

    if (councillorId) {
      // Validate the specified councillor exists and has the right role
      const councillor = await prisma.user.findUnique({
        where: { id: councillorId },
        select: {
          id: true,
          role: true,
          isActive: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!councillor || councillor.role !== "ward_councillor") {
        return sendError(
          res,
          "Specified user is not a ward councillor",
          "BAD_REQUEST",
          null,
          400,
        );
      }
      if (!councillor.isActive) {
        return sendError(
          res,
          "This councillor account is inactive",
          "BAD_REQUEST",
          null,
          400,
        );
      }

      targetCouncillorId = councillorId;
    } else {
      // Fall back: find councillor assigned to the application's ward
      const wardCouncillor = await prisma.user.findFirst({
        where: {
          role: "ward_councillor",
          assignedWardId: application.wardId,
          isActive: true,
        },
        select: { id: true },
      });

      // Ward councillor not found is a soft warning — not a hard block
      // LGA Admin can still forward and assign later
      targetCouncillorId = wardCouncillor?.id ?? null;
    }

    const updated = await prisma.stateOfOriginApplication.update({
      where: { id: String(id) },
      data: {
        status: "forwarded_to_councillor",
        reviewedByAdminId: adminId,
        reviewedByAdminAt: new Date(),
        reviewNotes,
        assignedCouncillorId: targetCouncillorId, // can be null if no councillor found
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "application_submitted",
        entity: "StateOfOriginApplication",
        entityId: String(id),
        userId: adminId,
        details: {
          action: "forwarded_to_councillor",
          reviewNotes,
          assignedCouncillorId: targetCouncillorId,
          routingMode: councillorId ? "manual" : "ward_based",
        },
        ipAddress: getIp(req),
      },
    });

    // TODO Phase 7: Notify assigned councillor

    return sendSuccess(
      res,
      updated,
      "Application forwarded to Ward Councillor",
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// WARD COUNCILLOR — Approve / Reject
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/state-of-origin/councillor/queue
 * Ward Councillor sees only their ward's pending applications.
 */
// GET /api/v1/state-of-origin/councillor/queue
export const getCouncillorQueue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const councillorId = req.user!.id;

    const councillor = await prisma.user.findUnique({
      where: { id: councillorId },
      select: { assignedWardId: true },
    });

    // Fetch applications where:
    // Option A — explicitly assigned to this councillor (new flow)
    // Option B — ward matches councillor's assigned ward (old flow fallback)
    const applications = await prisma.stateOfOriginApplication.findMany({
      where: {
        status: "forwarded_to_councillor",
        OR: [
          { assignedCouncillorId: councillorId }, // manually assigned
          {
            // ward-based fallback
            assignedCouncillorId: null,
            wardId: councillor?.assignedWardId ?? "NO_WARD",
          },
        ],
      },
      include: {
        applicant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        ward: { select: { id: true, name: true } },
        invoice: { select: { id: true, status: true, totalAmount: true } },
        assignedCouncillor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            assignedWard: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // return sendSuccess(res, applications);
    return res.status(200).json(applications);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/state-of-origin/councillor/:id/decide
 * Ward Councillor approves or rejects.
 * On approval → certificate is auto-generated.
 */
export const decideonApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const councillorId = req.user!.id;
    const { decision, councillorNotes, rejectionReason } = req.body;

    const councillor = await prisma.user.findUnique({
      where: { id: councillorId },
      select: { wardId: true },
    });

    const application = await prisma.stateOfOriginApplication.findUnique({
      where: { id },
    });

    if (!application)
      return sendError(res, "Application not found", "NOT_FOUND", null, 404);

    // Councillor can only decide on their own ward's applications
    // if (application.wardId !== councillor?.wardId) {
    //   return sendError(res, 'This application does not belong to your ward', 'FORBIDDEN', null, 403);
    // }

    if (application.status !== ApplicationStatus.forwarded_to_councillor) {
      return sendError(
        res,
        "Application is not pending councillor decision",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // ❌ CASE 1: REJECTED
    if (decision === "rejected") {
      const updated = await prisma.stateOfOriginApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.rejected,
          approvedByCouncillorId: councillorId,
          approvedByCouncillorAt: new Date(),
          councillorNotes,
          rejectionReason,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "application_rejected",
          entity: "StateOfOriginApplication",
          entityId: id,
          userId: councillorId,
          details: { rejectionReason },
          ipAddress: req.ip || "127.0.0.1",
        },
      });

      // TODO: Notify citizen of rejection via SMS / Email
      return sendSuccess(res, updated, "Application rejected successfully");
    }

    // ✅ CASE 2: APPROVED — generate certificate securely in single isolation transaction
    const result = await prisma.$transaction(async (tx) => {
      // 🚀 Fix: Flip status string to 'approved' to guarantee a match for getCertificateData
      const updatedApplication = await tx.stateOfOriginApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.approved,
          approvedByCouncillorId: councillorId,
          approvedByCouncillorAt: new Date(),
          councillorNotes,
        },
      });

      // Generate custom serial token matching your UI screenshot format layout context
      const currentYear = new Date().getFullYear();
      const randomSuffix = Math.floor(10000 + Math.random() * 90000); // 5-digit verification serial fallback
      const shortId = id.slice(0, 5).toUpperCase();

      const generatedCertNo = `INE-${currentYear}-${shortId}`;
      const uniqueVerificationCode = `V-CODE-${currentYear}-${randomSuffix}`;

      const certificate = await tx.certificate.create({
        data: {
          applicationId: id,
          certificateNumber: generatedCertNo, // Matches "INE-2026-08214" layout template format schema
          verificationCode: uniqueVerificationCode,
          qrToken: generatedCertNo,
          issuedAt: new Date(),
        },
      });

      return { application: updatedApplication, certificate };
    });

    await prisma.auditLog.create({
      data: {
        action: "certificate_issued",
        entity: "Certificate",
        entityId: result.certificate.id,
        userId: councillorId,
        details: {
          applicationId: id,
          certificateNumber: result.certificate.certificateNumber,
        },
        ipAddress: req.ip || "127.0.0.1",
      },
    });

    // TODO: Notify citizen — certificate ready for download via background mail task context

    return sendSuccess(
      res,
      result,
      "Application approved and certificate issued successfully",
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// PUBLIC — Verification (no auth required)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/state-of-origin/verify/:code
 * Public verification page endpoint
 */
// export const verifyCertificate = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const code = Array.isArray(req.params.code)
//       ? req.params.code[0]
//       : req.params.code;

//     // Search explicitly by certificate credentials
//     const certificate = await prisma.certificate.findFirst({
//       where: {
//         OR: [
//           { certificateNumber: code },
//           { verificationCode: code },
//           { qrToken: code },
//         ],
//       },
//       include: {
//         application: {
//           include: {
//             ward: true,
//             applicant: true,
//           },
//         },
//       },
//     });

//     if (!certificate) {
//       return sendError(
//         res,
//         "Certificate not found or invalid verification code",
//         "NOT_FOUND",
//         null,
//         404,
//       );
//     }

//     const isExpired = certificate.expiresAt
//       ? certificate.expiresAt < new Date()
//       : false;
//     const app = certificate.application;

//     return sendSuccess(res, {
//       valid: !isExpired && app.status === "approved",
//       certificateNumber: certificate.certificateNumber,
//       issuedAt: certificate.issuedAt,
//       expiresAt: certificate.expiresAt,
//       isExpired,
//       holder: (
//         app.fullName || `${app.applicant?.firstName} ${app.applicant?.lastName}`
//       ).toUpperCase(),
//       gender: app.gender || "N/A",
//       ward: app.ward?.name || "Central",
//       purpose: app.purpose || "General Purpose",
//       issuingAuthority: "Ijebu North East Local Government",
//     });
//   } catch (err) {
//     next(err);
//   }
// };



/**
 * GET /api/v1/public/verify/:code
 * Unified public verification endpoint for SOO Certificates, Levies, and Permits
 */
export const publicVerify = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const code = Array.isArray(req.params.code)
      ? req.params.code[0]
      : req.params.code;

    const cleanSearchCode = String(code).trim();

    // 1. Check for SOO Certificate first
    const certificate = await prisma.certificate.findFirst({
      where: {
        OR: [
          { certificateNumber: cleanSearchCode },
          { certificateNumber: cleanSearchCode.toUpperCase() },
          { verificationCode: cleanSearchCode },
          { qrToken: cleanSearchCode },
        ],
      },
      include: {
        application: {
          include: {
            ward: true,
            applicant: true,
          },
        },
      },
    });

    if (certificate) {
      const isExpired = certificate.expiresAt
        ? certificate.expiresAt < new Date()
        : false;
      const app = certificate.application;
      const isValid = !isExpired && app.status === "approved";

      return sendSuccess(res, {
        type: "SOO", // Unified discriminator
        valid: isValid,
        verificationCode: cleanSearchCode,
        title: "State of Origin Certificate",
        idNumber: certificate.certificateNumber,
        holder: (
          app.fullName || `${app.applicant?.firstName} ${app.applicant?.lastName}`
        ).toUpperCase(),
        issuedAt: certificate.issuedAt,
        expiresAt: certificate.expiresAt,
        isExpired,
        metadata: {
          gender: app.gender || "N/A",
          ward: app.ward?.name || "Central",
          purpose: app.purpose || "General Purpose",
        },
        issuingAuthority: "Ijebu North East Local Government",
      });
    }

    // 2. If not a certificate, check if it's a Receipt (covers paid Levies and Permits)
    const receipt = await prisma.receipt.findFirst({
      where: {
        OR: [
          { receiptNumber: cleanSearchCode },
          { receiptNumber: cleanSearchCode.toUpperCase() },
          { verificationCode: cleanSearchCode },
          { qrToken: cleanSearchCode },
        ],
      },
      include: {
        invoice: {
          include: {
            business: {
              select: { businessName: true, ownerName: true, address: true, ward: { select: { name: true } } },
            },
            category: true,
          },
        },
        issuedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (receipt) {
      // Determine if it represents a Permit or a standard Levy based on config parameters
      const invoiceCategory = receipt.invoice.category;
      const isPermitType = invoiceCategory?.type === "PERMIT" || invoiceCategory?.name?.toUpperCase().includes("PERMIT");
      const documentType = isPermitType ? "PERMIT" : "LEVY";

      return sendSuccess(res, {
        type: documentType, // Unified discriminator: LEVY or PERMIT
        valid: true, // If a receipt exists in DB, it is valid/paid
        verificationCode: cleanSearchCode,
        title: isPermitType ? "Business Operational Permit Receipt" : "Revenue Collection Receipt",
        idNumber: receipt.receiptNumber,
        holder: receipt.invoice.business?.businessName || receipt.invoice.business?.ownerName || "N/A",
        issuedAt: receipt.issuedAt,
        expiresAt: null, // Receipts don't expire, though permits can
        isExpired: false,
        amount: receipt.amountPaid,
        metadata: {
          ownerName: receipt.invoice.business?.ownerName || "N/A",
          businessAddress: receipt.invoice.business?.address || "N/A",
          categoryName: invoiceCategory?.name || "General Revenue",
          wardName: receipt.invoice.business?.ward?.name || "N/A",
          issuedBy: receipt.issuedBy ? { firstName: receipt.issuedBy.firstName, lastName: receipt.issuedBy.lastName } : "System Generated",
        },
        issuingAuthority: "Ijebu North East Local Government",
      });
    }

    // 3. Neither found
    return sendError(
      res,
      "Verification code not found or invalid",
      "NOT_FOUND",
      null,
      404,
    );
  } catch (err) {
    next(err);
  }
}


/**
 * GET /api/v1/soo/applications/:applicationId/certificate
 * Fetches data for Lovable's print layout page wrapper
 */
export const getCertificateData = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { applicationId } = req.params;

    // 1. Fetch the certificate first, pulling along its application tree metadata
    const certificate = await prisma.certificate.findUnique({
      where: { applicationId: String(applicationId) },
      include: {
        application: {
          include: {
            applicant: true,
            ward: true,
          },
        },
      },
    });

    if (!certificate) {
      return sendError(
        res,
        "Official approved certificate record not found",
        "NOT_FOUND",
        null,
        404,
      );
    }

    const app = certificate.application;

    // 2. Safeguard councillor name lookups against unexpected null fields
    let councillorNameString = "Hon. Administrative Chairman";
    if (app.approvedByCouncillorId) {
      const councillor = await prisma.user.findUnique({
        where: { id: app.approvedByCouncillorId },
        select: { firstName: true, lastName: true },
      });
      if (councillor) {
        councillorNameString = `Hon. ${councillor.firstName} ${councillor.lastName}`;
      }
    }

    // 3. Build the perfect UI-ready payload contract match pattern
    const payload = {
      id: app.id,
      fullName: (
        app.fullName || `${app.applicant?.firstName} ${app.applicant?.lastName}`
      ).toUpperCase(),
      dateOfBirth: app.dateOfBirth
        ? new Date(app.dateOfBirth).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "Not Specified",
      gender: app.gender || "N/A",
      ward: app.ward?.name || "Central",
      state: "Ogun State",
      issuedAt: certificate.issuedAt,
      certificateNumber: certificate.certificateNumber,
      councillorName: councillorNameString,
      issuedBy: "Ijebu North East LGA Council",
      // Build the live routing link so the scanned QR takes users directly to the confirmation screen
      verificationUrl: `https://logmas.gov.ng/verify/${certificate.certificateNumber}`,
      qrToken: certificate.qrToken,
    };

    return sendSuccess(
      res,
      payload,
      "Certificate metrics compiled successfully",
    );
  } catch (err) {
    next(err);
  }
};
