// src/modules/business/business.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import {
  generateReceiptNumber,
  generateVerificationCode,
  generateQrToken,
} from '../../utils/generators';
import { InvoiceStatus, RevenueCategory } from '@prisma/client';
import { getIp, queryString } from '../complaints/complaints.controller';

// ─────────────────────────────────────────────────────────────
// BUSINESS PROFILE
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/business
 * Business owner registers their business.
 * One active business per user enforced.
 */
export const createBusiness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user!.id;
    const { businessName, ownerName, address, phone, email, cacNumber, category, description, wardId } = req.body;

    // One active business per owner
    const existing = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
    });
    if (existing) {
      return sendError(
        res,
        'You already have an active registered business. Update it instead.',
        'CONFLICT',
        null,
        409
      );
    }

    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);

    const business = await prisma.business.create({
      data: { businessName, ownerName, address, phone, email, cacNumber, category, description, wardId, ownerId },
      include: { ward: { select: { id: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_created', // closest available — business registration
        entity: 'Business',
        entityId: business.id,
        userId: ownerId,
        details: { businessName, category },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, business, 'Business registered successfully', 201);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/business/my
 * Business owner views their own business profile.
 */
export const getMyBusiness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user!.id;

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
      include: {
        ward: { select: { id: true, name: true, code: true } },
        permits: {
          where: { status: { in: ['issued', 'pending_payment'] } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true, permitNumber: true, permitType: true,
            status: true, validFrom: true, validTo: true,
          },
        },
      },
    });

    if (!business) {
      return sendError(res, 'No registered business found. Please register your business first.', 'NOT_FOUND', null, 404);
    }

    return sendSuccess(res, business);
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/business/my
 * Business owner updates their own business profile.
 */
export const updateMyBusiness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user!.id;

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
    });
    if (!business) return sendError(res, 'No active business found', 'NOT_FOUND', null, 404);

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: req.body,
      include: { ward: { select: { id: true, name: true } } },
    });

    return sendSuccess(res, updated, 'Business profile updated');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// TRADE PERMITS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/business/permits
 * Business owner applies for a trade permit.
 * Creates permit (pending_payment) + invoice atomically.
 * Virtual account generation stubbed — wired in Phase 7.
 */
export const applyForPermit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user!.id;
    const { businessId, permitType, category, validFrom } = req.body;

    // Ownership check — business must belong to this owner
    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId, isActive: true },
    });
    if (!business) {
      return sendError(res, 'Business not found or does not belong to you', 'FORBIDDEN', null, 403);
    }

    // Block duplicate active permit of same type
    const activePermit = await prisma.permit.findFirst({
      where: {
        businessId,
        category: category as RevenueCategory,
        status: { in: ['pending_payment', 'issued'] },
      },
    });
    if (activePermit) {
      return sendError(
        res,
        'An active or pending permit of this type already exists for this business',
        'CONFLICT',
        null,
        409
      );
    }

    // Fetch levy pricing configured by Treasurer
    const levyConfig = await prisma.levyConfig.findFirst({
      where: { category: category as RevenueCategory, isActive: true },
    });

    const totalAmount = levyConfig?.amount ?? 10000; // fallback until Treasurer configures

    // Calculate validity period from levy config billing cycle
    const startDate = validFrom ? new Date(validFrom) : new Date();
    const endDate = getPermitEndDate(startDate, levyConfig?.billingCycle ?? 'yearly');

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create invoice first
      const invoice = await tx.invoice.create({
        data: {
          category: category as RevenueCategory,
          description: `${permitType} — ${business.businessName}`,
          subtotal: totalAmount,
          totalAmount,
          balanceDue: totalAmount,
          status: 'sent',
          levyConfigId: levyConfig?.id,
          createdById: ownerId,
          businessId,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          // TODO Phase 7: virtualAccountNo, virtualAccountBank, virtualAccountRef
        },
      });

      // 2. Create permit linked to invoice
      const permit = await tx.permit.create({
        data: {
          permitNumber: generateReceiptNumber('PRM'),
          verificationCode: generateVerificationCode(),
          qrToken: generateQrToken(),
          status: 'pending_payment',
          permitType,
          category: category as RevenueCategory,
          validFrom: startDate,
          validTo: endDate,
          businessId,
          issuedById: ownerId,
          invoiceId: invoice.id,
        },
      });

      return { permit, invoice };
    });

    await prisma.auditLog.create({
      data: {
        action: 'invoice_created',
        entity: 'Permit',
        entityId: result.permit.id,
        userId: ownerId,
        details: { permitType, category, businessId, invoiceId: result.invoice.id },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(
      res,
      {
        permit: result.permit,
        invoice: result.invoice,
        paymentNote: 'Invoice generated. Complete payment to activate your permit.',
      },
      'Permit application submitted. Proceed to payment.',
      201
    );
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/business/permits
 * Business owner views all their permits.
 */
export const getMyPermits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user!.id;

    // 1. Fetch all active businesses owned by this user
    const businesses = await prisma.business.findMany({
      where: { ownerId, deletedAt: null },
      select: { id: true, businessName: true }
    });

    if (!businesses.length) {
      return sendSuccess(res, []); // Return empty array so UI handles <EmptyState> cleanly
    }

    const businessIds = businesses.map(b => b.id);
    // Create a fast lookup map for business names
    const businessNameMap = new Map(businesses.map(b => [b.id, b.businessName]));

    // 2. Fetch all permits tied to any of those businesses
    const permits = await prisma.permit.findMany({
      where: { 
        businessId: { in: businessIds } 
      },
      include: {
        invoice: {
          select: { id: true, status: true, totalAmount: true, balanceDue: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Shape the response payload data so it matches the exact property structure the frontend components read
    const formattedPermits = permits.map(p => ({
      id: p.id,
      permitNumber: p.permitNumber,
      permitType: p.permitType ?? 'Trade Permit',
      status: p.status, // e.g. "issued", "pending"
      issueDate: p.validFrom,
      expiryDate: p.validTo,
      qrToken: p.qrToken ?? `VERIFY-${p.permitNumber}`,
      
      // Inject parameters the frontend assumes exist on the root object
      businessName: businessNameMap.get(p.businessId) || 'Unknown Business',
      fee: Number(p.invoice?.totalAmount ?? 0), 
      invoiceId: p.invoice?.id ?? null,
      
      // Keep nested invoice relation structure intact just in case
      invoice: p.invoice
    }));

    return sendSuccess(res, formattedPermits);
  } catch (err) { 
    next(err); 
  }
};
/**
 * GET /api/v1/business/permits/:id
 * Business owner views a single permit — ownership enforced.
 */
export const getMyPermitById = async (req: Request, res: Response, next: NextFunction) => {
  try {
      let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const ownerId = req.user!.id;

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
      select: { id: true },
    });
    if (!business) return sendError(res, 'No active business found', 'NOT_FOUND', null, 404);

    const permit = await prisma.permit.findFirst({
      where: { id, businessId: business.id }, // ownership at query level
      include: {
        business: { select: { id: true, businessName: true, address: true } },
        invoice: true,
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!permit) return sendError(res, 'Permit not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, permit);
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/business/permits/:id/renew
 * Business owner renews an existing expired or issued permit.
 * Creates a new permit + new invoice for the renewal period.
 */
export const renewPermit = async (req: Request, res: Response, next: NextFunction) => {
  try {
      let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const ownerId = req.user!.id;
    const { validFrom } = req.body;

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
      select: { id: true, businessName: true },
    });
    if (!business) return sendError(res, 'No active business found', 'NOT_FOUND', null, 404);

    const existingPermit = await prisma.permit.findFirst({
      where: { id, businessId: business.id },
    });

    if (!existingPermit) return sendError(res, 'Permit not found', 'NOT_FOUND', null, 404);

    if (!['issued', 'expired'].includes(existingPermit.status)) {
      return sendError(
        res,
        'Only issued or expired permits can be renewed',
        'BAD_REQUEST',
        null,
        400
      );
    }

    const levyConfig = await prisma.levyConfig.findFirst({
      where: { category: existingPermit.category, isActive: true },
    });

    const totalAmount = levyConfig?.amount ?? 10000;
    const startDate = validFrom ? new Date(validFrom) : new Date();
    const endDate = getPermitEndDate(startDate, levyConfig?.billingCycle ?? 'yearly');

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          category: existingPermit.category,
          description: `Permit Renewal — ${existingPermit.permitType} — ${business.businessName}`,
          subtotal: totalAmount,
          totalAmount,
          balanceDue: totalAmount,
          status: 'sent',
          levyConfigId: levyConfig?.id,
          createdById: ownerId,
          businessId: business.id,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const renewedPermit = await tx.permit.create({
        data: {
          permitNumber: generateReceiptNumber('PRM'),
          verificationCode: generateVerificationCode(),
          qrToken: generateQrToken(),
          status: 'pending_payment',
          permitType: existingPermit.permitType,
          category: existingPermit.category,
          validFrom: startDate,
          validTo: endDate,
          businessId: business.id,
          issuedById: ownerId,
          invoiceId: invoice.id,
        },
      });

      // Mark old permit as expired
      await tx.permit.update({
        where: { id: existingPermit.id },
        data: { status: 'expired' },
      });

      return { permit: renewedPermit, invoice };
    });

    return sendSuccess(
      res,
      {
        permit: result.permit,
        invoice: result.invoice,
        paymentNote: 'Renewal invoice generated. Complete payment to activate.',
      },
      'Permit renewal initiated. Proceed to payment.'
    );
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/business/invoices
 * Business owner views all invoices for their business.
 */
export const getMyInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user!.id;
    const status = queryString(req.query.status) as InvoiceStatus | undefined;
    const page   = parseInt(queryString(req.query.page)  ?? '1');
    const limit  = parseInt(queryString(req.query.limit) ?? '10');
    const skip   = (page - 1) * limit;

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
      select: { id: true },
    });
    if (!business) return sendError(res, 'No active business found', 'NOT_FOUND', null, 404);

    const where: any = {
      businessId: business.id,
      ...(status && { status }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          levyConfig: { select: { name: true, billingCycle: true } },
          receipt: { select: { id: true, receiptNumber: true, issuedAt: true } },
          permit: { select: { id: true, permitNumber: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    return sendSuccess(res, {
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/business/invoices/:id
 * Business owner views a single invoice — ownership enforced via business link.
 */
export const getMyInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
      let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const ownerId = req.user!.id;

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
      select: { id: true },
    });
    if (!business) return sendError(res, 'No active business found', 'NOT_FOUND', null, 404);

    const invoice = await prisma.invoice.findFirst({
      where: { id, businessId: business.id }, // ownership at query level
      include: {
        levyConfig: { select: { name: true, category: true, billingCycle: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        receipt: true,
        permit: { select: { id: true, permitNumber: true, status: true, validFrom: true, validTo: true } },
      },
    });

    if (!invoice) return sendError(res, 'Invoice not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, invoice);
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// PUBLIC — Permit Verification (no auth)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/business/permits/verify/:code
 * Anyone can verify a permit via verification code or QR token.
 */
/**
 * GET /api/v1/permits/verify/:code
 * Anyone can verify a permit via verification code or QR token.
 */
export const verifyPermit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // FIX #1: Ensure code is a string (Express params can be string[])
    const code = Array.isArray(req.params.code) 
      ? req.params.code[0] 
      : req.params.code;

    if (!code) {
      return sendError(res, 'Verification code is required', 'BAD_REQUEST', null, 400);
    }

    // FIX #2: Use explicit typing for Prisma query with include
    const permit = await prisma.permit.findFirst({
      where: {
        OR: [
          { verificationCode: code },
          { qrToken: code }
        ],
        // deletedAt: null, // Soft delete filter
      },
      include: {
        business: {
          select: {
            businessName: true,
            ownerName: true,
            address: true,
            category: true,
            ward: { 
              select: { name: true } 
            },
          },
        },
      },
    });

    if (!permit) {
      return sendError(res, 'Permit not found or invalid verification code', 'NOT_FOUND', null, 404);
    }

    // Safety check: business relation might be null if not loaded
    if (!permit.business) {
      return sendError(res, 'Permit data incomplete', 'INTERNAL_ERROR', null, 500);
    }

    const now = new Date();
    const isExpired = permit.validTo ? permit.validTo < now : false;
    const isValid = permit.status === 'issued' && !isExpired;

    return sendSuccess(res, {
      valid: isValid,
      status: permit.status,
      isExpired,
      permitNumber: permit.permitNumber,
      permitType: permit.permitType, // Ensure this field exists in schema
      category: permit.category,
      validFrom: permit.validFrom,
      validTo: permit.validTo,
      issuedAt: permit.createdAt,
      business: {
        name: permit.business.businessName,
        owner: permit.business.ownerName,
        address: permit.business.address,
        category: permit.business.category,
        ward: permit.business.ward?.name || 'Unknown',
      },
      issuingAuthority: 'Ijebu North East Local Government',
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const getPermitEndDate = (startDate: Date, billingCycle: string): Date => {
  const end = new Date(startDate);
  switch (billingCycle) {
    case 'daily':   end.setDate(end.getDate() + 1);     break;
    case 'weekly':  end.setDate(end.getDate() + 7);     break;
    case 'monthly': end.setMonth(end.getMonth() + 1);   break;
    case 'yearly':  end.setFullYear(end.getFullYear() + 1); break;
    default:        end.setFullYear(end.getFullYear() + 1); // default to yearly
  }
  return end;
};