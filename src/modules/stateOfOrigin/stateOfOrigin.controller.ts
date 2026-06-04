// src/modules/stateOfOrigin/stateOfOrigin.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { generateReceiptNumber, generateVerificationCode, generateQrToken } from '../../utils/generators';

// ─────────────────────────────────────────────────────────────
// CITIZEN
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/state-of-origin
 * Citizen submits a new application.
 * Creates the application + a draft invoice automatically.
 */
export const submitApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const citizenId = req.user!.id;
    const {
      fullName, dateOfBirth, gender, address,
      phone, email, wardId, purpose, nin, passportUrl,
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
    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);

    // Fetch levy config for state of origin fee (set by Treasurer)
    const levyConfig = await prisma.levyConfig.findFirst({
      where: { category: 'state_of_origin_fee', isActive: true },
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
          wardId,
          purpose,
          nin,
          passportUrl,
          applicantId: citizenId,
          status: 'submitted',
        },
      });

      const totalAmount = levyConfig?.amount ?? 5000; // fallback if treasurer hasn't configured yet

      const invoice = await tx.invoice.create({
        data: {
          category: 'state_of_origin_fee',
          description: `State of Origin Application — ${fullName}`,
          subtotal: totalAmount,
          totalAmount,
          balanceDue: totalAmount,
          status: 'sent',
          levyConfigId: levyConfig?.id,
          createdById: citizenId,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // Link invoice to application
      const updatedApplication = await tx.stateOfOriginApplication.update({
        where: { id: application.id },
        data: { invoiceId: invoice.id, status: 'payment_pending' },
        include: { ward: true, invoice: true },
      });

      return updatedApplication;
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'application_submitted',
        entity: 'StateOfOriginApplication',
        entityId: result.id,
        userId: citizenId,
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, result, 'Application submitted successfully. Please proceed to payment.', 201);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/state-of-origin/my
 * Citizen views their own applications.
 */
export const getMyApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const citizenId = req.user!.id;

    const applications = await prisma.stateOfOriginApplication.findMany({
      where: { applicantId: citizenId },
      include: {
        ward: { select: { id: true, name: true, code: true } },
        invoice: { select: { id: true, status: true, totalAmount: true, balanceDue: true } },
        certificate: { select: { id: true, certificateNumber: true, issuedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, applications);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/state-of-origin/my/:id
 * Citizen views a specific application.
 */
export const getMyApplicationById = async (req: Request, res: Response, next: NextFunction) => {
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

    if (!application) return sendError(res, 'Application not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, application);
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// LGA ADMIN — Review & Forward
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/state-of-origin/admin
 * LGA Admin views all applications with filters.
 */
export const getAllApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, status, wardId } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (wardId) where.wardId = wardId;

    const [applications, total] = await Promise.all([
      prisma.stateOfOriginApplication.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          applicant: { select: { id: true, firstName: true, lastName: true, email: true } },
          ward: { select: { id: true, name: true, code: true } },
          invoice: { select: { id: true, status: true, totalAmount: true } },
          certificate: { select: { id: true, certificateNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stateOfOriginApplication.count({ where }),
    ]);

    return sendSuccess(res, {
      data: applications,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/state-of-origin/admin/:id
 * LGA Admin views a single application in full detail.
 */
export const getApplicationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const application = await prisma.stateOfOriginApplication.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        ward: true,
        invoice: true,
        certificate: true,
      },
    });

    if (!application) return sendError(res, 'Application not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, application);
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/state-of-origin/admin/:id/forward
 * LGA Admin reviews and forwards to Ward Councillor.
 * Only allowed if application is in 'paid' status.
 */
export const forwardToCouncillor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;
    const { reviewNotes } = req.body;

    const application = await prisma.stateOfOriginApplication.findUnique({
      where: { id },
      include: { invoice: true },
    });

    if (!application) return sendError(res, 'Application not found', 'NOT_FOUND', null, 404);

    if (application.status !== 'paid') {
      return sendError(
        res,
        'Only paid applications can be forwarded for approval',
        'BAD_REQUEST',
        null,
        400
      );
    }

    const updated = await prisma.stateOfOriginApplication.update({
      where: { id },
      data: {
        status: 'forwarded_to_councillor',
        reviewedByAdminId: adminId,
        reviewedByAdminAt: new Date(),
        reviewNotes,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'application_submitted', // reusing closest action; extend enum if needed
        entity: 'StateOfOriginApplication',
        entityId: id,
        userId: adminId,
        details: { action: 'forwarded_to_councillor', reviewNotes },
        ipAddress: req.ip,
      },
    });

    // TODO: Notify ward councillor via notification system
    return sendSuccess(res, updated, 'Application forwarded to Ward Councillor');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// WARD COUNCILLOR — Approve / Reject
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/state-of-origin/councillor/queue
 * Ward Councillor sees only their ward's pending applications.
 */
export const getCouncillorQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const councillorId = req.user!.id;

    // Get councillor's assigned ward
    const councillor = await prisma.user.findUnique({
      where: { id: councillorId },
      select: { wardId: true },
    });

    if (!councillor?.wardId) {
      return sendError(res, 'No ward assigned to this councillor', 'BAD_REQUEST', null, 400);
    }

    const applications = await prisma.stateOfOriginApplication.findMany({
      where: {
        wardId: councillor.wardId,
        status: 'forwarded_to_councillor',
      },
      include: {
        applicant: { select: { id: true, firstName: true, lastName: true, email: true } },
        ward: { select: { id: true, name: true } },
        invoice: { select: { id: true, status: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'asc' }, // oldest first — process in order
    });

    return sendSuccess(res, applications);
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/state-of-origin/councillor/:id/decide
 * Ward Councillor approves or rejects.
 * On approval → certificate is auto-generated.
 */
export const decideonApplication = async (req: Request, res: Response, next: NextFunction) => {
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

    if (!application) return sendError(res, 'Application not found', 'NOT_FOUND', null, 404);

    // Councillor can only decide on their own ward's applications
    if (application.wardId !== councillor?.wardId) {
      return sendError(res, 'This application does not belong to your ward', 'FORBIDDEN', null, 403);
    }

    if (application.status !== 'forwarded_to_councillor') {
      return sendError(res, 'Application is not pending councillor decision', 'BAD_REQUEST', null, 400);
    }

    if (decision === 'rejected') {
      const updated = await prisma.stateOfOriginApplication.update({
        where: { id },
        data: {
          status: 'rejected',
          approvedByCouncillorId: councillorId,
          approvedByCouncillorAt: new Date(),
          councillorNotes,
          rejectionReason,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'application_rejected',
          entity: 'StateOfOriginApplication',
          entityId: id,
          userId: councillorId,
          details: { rejectionReason },
          ipAddress: req.ip,
        },
      });

      // TODO: Notify citizen of rejection
      return sendSuccess(res, updated, 'Application rejected');
    }

    // APPROVED — generate certificate in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedApplication = await tx.stateOfOriginApplication.update({
        where: { id },
        data: {
          status: 'certificate_issued',
          approvedByCouncillorId: councillorId,
          approvedByCouncillorAt: new Date(),
          councillorNotes,
        },
      });

      const certificate = await tx.certificate.create({
        data: {
          applicationId: id,
          certificateNumber: generateReceiptNumber('CERT'),
          verificationCode: generateVerificationCode(),
          qrToken: generateQrToken(),
          issuedAt: new Date(),
          // expiresAt — optional, set if needed
        },
      });

      return { application: updatedApplication, certificate };
    });

    await prisma.auditLog.create({
      data: {
        action: 'certificate_issued',
        entity: 'Certificate',
        entityId: result.certificate.id,
        userId: councillorId,
        details: { applicationId: id },
        ipAddress: req.ip,
      },
    });

    // TODO: Notify citizen — certificate ready for download

    return sendSuccess(res, result, 'Application approved and certificate issued');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// PUBLIC — Verification (no auth required)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/state-of-origin/verify/:code
 * Anyone can verify a certificate by verification code or QR token.
 */
export const verifyCertificate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const { code } = req.params;
     const code = Array.isArray(req.params.code) 
      ? req.params.code[0] 
      : req.params.code;

    const certificate = await prisma.certificate.findFirst({
      where: {
        OR: [{ verificationCode: code }, { qrToken: code }],
      },
      include: {
        application: {
          select: {
            fullName: true,
            gender: true,
            address: true,
            purpose: true,
            status: true,
            ward: { select: { name: true } },
            applicant: { select: { email: true } },
          },
        },
      },
    });

    if (!certificate) {
      return sendError(res, 'Certificate not found or invalid verification code', 'NOT_FOUND', null, 404);
    }

    const isExpired = certificate.expiresAt ? certificate.expiresAt < new Date() : false;

    return sendSuccess(res, {
      valid: !isExpired,
      certificateNumber: certificate.certificateNumber,
      issuedAt: certificate.issuedAt,
      expiresAt: certificate.expiresAt,
      isExpired,
      holder: certificate.application.fullName,
      gender: certificate.application.gender,
      ward: certificate.application.ward.name,
      purpose: certificate.application.purpose,
      issuingAuthority: 'Ijebu North East Local Government',
    });
  } catch (err) { next(err); }
};