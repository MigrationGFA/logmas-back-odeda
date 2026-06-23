// src/modules/fieldOfficer/fieldOfficer.controller.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../../utils/prisma";
import { sendSuccess, sendError } from "../../utils/response";
import {
  generateReceiptNumber,
  generateVerificationCode,
  generateQrToken,
  generateReference,
} from "../../utils/generators";
import { RevenueCategory, PaymentMethod, Role } from "@prisma/client";
import { getIp, queryString } from "../complaints/complaints.controller";

// ─────────────────────────────────────────────────────────────
// BUSINESS REGISTRATION
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/field-officer/businesses
 * Field officer registers a business manually in the field.
 * Unlike business owner self-registration, officer can register
 * on behalf of any business — no one-per-owner restriction.
 */
export const registerBusiness = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const officerId = req.user!.id;
    const {
      businessName,
      ownerName,
      address,
      phone,
      email,
      cacNumber,
      category,
      description,
      wardId,
    } = req.body;

    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) return sendError(res, "Ward not found", "NOT_FOUND", null, 404);

    // Check if a business with same name + phone already exists in this ward
    const duplicate = await prisma.business.findFirst({
      where: { businessName, phone, wardId, isActive: true },
    });
    if (duplicate) {
      return sendError(
        res,
        "A business with this phone number already exists in this ward",
        "CONFLICT",
        null,
        409,
      );
    }

    // Field officers register businesses under their own user ID as owner
    // This is intentional — the "owner" here is the registered business owner (person),
    // not a system user. The field officer is just the registrar.
    const business = await prisma.business.create({
      data: {
        businessName,
        ownerName,
        address,
        phone,
        email,
        cacNumber,
        category,
        description,
        wardId,
        ownerId: officerId, // field officer is the registrar/proxy owner in the system
      },
      include: { ward: { select: { id: true, name: true, code: true } } },
    });

    await prisma.auditLog.create({
      data: {
        action: "user_created",
        entity: "Business",
        entityId: business.id,
        userId: officerId,
        details: { businessName, ownerName, registeredByOfficer: true },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, business, "Business registered successfully", 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/field-officer/businesses
 * Fetches all active businesses in the Field Officer's assigned ward
 * to enable fast, zero-latency client-side search.
 */
export const getAllWardBusinesses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Structural safety enforcement using logged-in officer session context
    if (!req.user || !req.user.wardId) {
      res.status(403).json({
        success: false,
        message:
          "Access Denied: Missing localized structural geographic scope bindings.",
      });
      return;
    }

    const { wardId } = req.user;

    // 2. Fetch the entire active commercial footprint for this specific ward boundary
    const businesses = await prisma.business.findMany({
      where: {
        wardId: wardId,
        isActive: true,
        deletedAt: null, // Safeguard against soft-deleted records
      },
      include: {
        ward: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        permits: {
          where: { status: "issued" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            validTo: true,
            status: true,
          },
        },
      },
      orderBy: { businessName: "asc" },
    });

    // 3. Return the payload cleanly. Frontend can now process instant offline/local text parsing
    return sendSuccess(res, {
      data: businesses,
      meta: {
        total: businesses.length,
        wardId,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// INVOICE GENERATION
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/field-officer/invoices
 * Field officer generates an invoice for any levy category.
 * Treasurer's LevyConfig pricing is used automatically.
 * Officer can supply overrideAmount only if no config exists.
 */
export const generateInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const officerId = req.user!.id;
    const {
      // Business — either existing ID or new business details
      businessId,
      // New business fields (used only if businessId not provided)
      businessName,
      ownerName,
      phone,
      email,
      address,
      wardId,
      category: businessCategory,

      // Invoice fields
      categoryId, // RevenueCategory.id
      levyConfigId, // LevyConfig.id (optional — officer picks from treasurer config)
      description,
      overrideAmount, // only used if no levyConfig exists
      quantity = 1,
      dueDate,
    } = req.body;

    // ── 1. Resolve or create business ────────────────────────
    let business: { id: string; businessName: string; ownerId: string } | null =
      null;

    if (businessId) {
      business = await prisma.business.findUnique({
        where: { id: businessId, isActive: true },
        select: { id: true, businessName: true, ownerId: true },
      });
      if (!business)
        return sendError(res, "Business not found", "NOT_FOUND", null, 404);
    } else {
      // Create business on the fly — field officer registering a new customer
      if (!businessName || !ownerName || !phone || !wardId) {
        return sendError(
          res,
          "businessName, ownerName, phone and wardId are required when creating a new business",
          "BAD_REQUEST",
          null,
          400,
        );
      }

      const ward = await prisma.ward.findUnique({ where: { id: wardId } });
      if (!ward)
        return sendError(res, "Ward not found", "NOT_FOUND", null, 404);

      // Check if phone already registered in this ward
      const existing = await prisma.business.findFirst({
        where: { phone, wardId, isActive: true },
      });

      if (existing) {
        business = {
          id: existing.id,
          businessName: existing.businessName,
          ownerId: existing.ownerId,
        };
      } else {
        const created = await prisma.business.create({
          data: {
            businessName,
            ownerName,
            phone,
            email,
            address: address || "",
            category: businessCategory || "General",
            wardId,
            ownerId: officerId, // officer is the proxy owner
          },
          select: { id: true, businessName: true, ownerId: true },
        });
        business = created;
      }
    }

    // ── 2. Validate category exists ───────────────────────────
    const revenueCategory = await prisma.revenueCategory.findUnique({
      where: { id: categoryId },
    });
    if (!revenueCategory) {
      return sendError(
        res,
        "Revenue category not found",
        "NOT_FOUND",
        null,
        404,
      );
    }

    // ── 3. Block duplicate unpaid invoice ─────────────────────
    const unpaidInvoice = await prisma.invoice.findFirst({
      where: {
        businessId: business.id,
        categoryId,
        status: { in: ["sent", "draft", "partially_paid"] },
      },
    });
    if (unpaidInvoice) {
      return sendError(
        res,
        "This business already has an unpaid invoice for this category",
        "CONFLICT",
        null,
        409,
      );
    }

    // ── 4. Resolve pricing ────────────────────────────────────
    let levyConfig = null;
    let unitAmount: number;

    if (levyConfigId) {
      // Officer explicitly picked a levy config from the UI
      levyConfig = await prisma.levyConfig.findUnique({
        where: { id: levyConfigId, isActive: true },
      });
      if (!levyConfig) {
        return sendError(
          res,
          "Levy configuration not found or inactive",
          "NOT_FOUND",
          null,
          404,
        );
      }
      unitAmount = Number(levyConfig.amount);
    } else {
      // Fall back to first active config for this category
      levyConfig = await prisma.levyConfig.findFirst({
        where: { categoryId, isActive: true },
        orderBy: { createdAt: "desc" },
      });

      if (levyConfig) {
        unitAmount = Number(levyConfig.amount);
      } else if (overrideAmount) {
        unitAmount = Number(overrideAmount);
      } else {
        return sendError(
          res,
          "No levy configuration found for this category. Provide an override amount or ask the Treasurer to configure pricing.",
          "BAD_REQUEST",
          null,
          400,
        );
      }
    }

    // ── 5. Create invoice ─────────────────────────────────────
    const subtotal = unitAmount * Number(quantity);
    const totalAmount = subtotal;

    const invoice = await prisma.invoice.create({
      data: {
        categoryId,
        description:
          description || `${revenueCategory.name} — ${business.businessName}`,
        subtotal,
        totalAmount,
        balanceDue: totalAmount,
        status: "sent",
        levyConfigId: levyConfig?.id ?? null,
        createdById: officerId,
        assignedOfficerId: officerId,
        businessId: business.id,
        dueDate: dueDate
          ? new Date(dueDate)
          : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      include: {
        business: {
          select: {
            id: true,
            businessName: true,
            ownerName: true,
            phone: true,
          },
        },
        category: { select: { id: true, name: true, slug: true } },
        levyConfig: {
          select: { id: true, name: true, billingCycle: true, amount: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "invoice_created",
        entity: "Invoice",
        entityId: invoice.id,
        userId: officerId,
        details: { businessId: business.id, categoryId, totalAmount, quantity },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, invoice, "Invoice generated successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// PAYMENT RECORDING
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/field-officer/payments
 * Field officer records a cash or POS payment against an invoice.
 * On full payment → receipt is auto-generated immediately.
 * On partial payment → invoice status set to partially_paid.
 */
export const recordPayment = async (req: Request, res: Response, next: NextFunction) => {
 try {
    const officerId = req.user!.id;
    const actorRole = req.user!.role;
    
    // 1. Structural Parameter Sourcing
    let { permitId } = req.params;
    if (Array.isArray(permitId)) permitId = permitId[0];

    const { amount, method, reference, narration } = req.body;

    // Guard: Ensure only field collection agents can execute cash/POS settlements
    if (actorRole !== Role.field_officer && actorRole !== Role.super_admin && actorRole !== Role.lga_admin) {
      return sendError(res, "Unauthorized operational clearance level", "FORBIDDEN", null, 403);
    }

    // 2. Fetch the Permit and its direct unique Invoice relation
    const permit = await prisma.permit.findUnique({
      where: { id: permitId },
      include: {
        invoice: {
          include: {
            business: { select: { id: true, businessName: true } }
          }
        }
      }
    });

    if (!permit) return sendError(res, "Permit target record not found", "NOT_FOUND", null, 404);
    if (!permit.invoice) return sendError(res, "No attached billing ledger invoice found for this permit", "NOT_FOUND", null, 404);
    
    const invoice = permit.invoice;

    // Status Guards
    if (invoice.status === "paid" || permit.status === "issued") {
      return sendError(res, "This permit has already been paid and issued", "BAD_REQUEST", null, 400);
    }
    if (invoice.status === "cancelled") {
      return sendError(res, "Cannot collect funds against a cancelled invoice ledger", "BAD_REQUEST", null, 400);
    }

    const paymentAmount = Number(amount);
    const balanceDue = Number(invoice.balanceDue);

    if (paymentAmount > balanceDue) {
      return sendError(
        res,
        `Collection value (₦${paymentAmount}) exceeds outstanding balance due (₦${balanceDue})`,
        "BAD_REQUEST",
        null,
        400
      );
    }

    const isFullPayment = paymentAmount >= balanceDue;
    const newAmountPaid = Number(invoice.amountPaid) + paymentAmount;
    const newBalanceDue = balanceDue - paymentAmount;

    // 3. EXECUTE ATOMIC TRANSACTION CONTEXT
    const result = await prisma.$transaction(async (tx) => {
      
      // A. Write standard transaction payment log
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: paymentAmount,
          method: method as PaymentMethod,
          status: "confirmed",
          reference: reference || generateReference("PAY"),
          narration: narration || `Field collection for ${invoice.description}`,
          confirmedAt: new Date(),
          confirmedById: officerId,
          paidById: invoice.createdById,
        },
      });

      // B. Update Invoice Balancing Properties
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: isFullPayment ? "paid" : "partially_paid",
          paidAt: isFullPayment ? new Date() : null,
        },
      });

      let receipt = null;
      let updatedPermit = permit;

      // C. Action triggers for Full Settlements
      if (isFullPayment) {
        // Generate security-backed printable receipt layout
        receipt = await tx.receipt.create({
          data: {
            receiptNumber: generateReceiptNumber("RCP"),
            verificationCode: generateVerificationCode(),
            qrToken: generateQrToken(),
            amountPaid: newAmountPaid,
            invoiceId: invoice.id,
            issuedById: officerId,
          },
        });

        // Activate the document state instantly on the field
        updatedPermit = await tx.permit.update({
          where: { id: permitId },
          data: { status: 'issued' },
          include: {
            invoice: {
              include: {
                business: {
                  select: { id: true, businessName: true },
                },
              },
            },
            business: {
              select: { id: true, businessName: true },
            },
          },
        });
      }

      return { payment, invoice: updatedInvoice, receipt, permit: updatedPermit };
    });

    // 4. Trace Operations securely through background Audit Log chains
    await prisma.auditLog.create({
      data: {
        action: "payment_confirmed",
        entity: "Payment",
        entityId: result.payment.id,
        userId: officerId,
        details: { invoiceId: invoice.id, permitId, amount: paymentAmount, method, isFullPayment },
        ipAddress: getIp(req),
      },
    });

    if (result.receipt) {
      await prisma.auditLog.create({
        data: {
          action: "permit_issued",
          entity: "Permit",
          entityId: permitId,
          userId: officerId,
          details: { receiptId: result.receipt.id, invoiceId: invoice.id },
          ipAddress: getIp(req),
        },
      });
    }

    return sendSuccess(
      res,
      {
        payment: result.payment,
        invoice: result.invoice,
        receipt: result.receipt,
        permit: result.permit,
        message: isFullPayment 
          ? "Payment processed fully. Permit document is now active and issued."
          : `Partial collection logged. Balance outstanding: ₦${newBalanceDue}`,
      },
      isFullPayment ? "Collection settled and permit issued." : "Partial settlement recorded."
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// PERMIT ISSUANCE
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/field-officer/permits
 * Field officer issues a permit immediately after payment is confirmed.
 * Invoice must be in 'paid' status before permit can be issued.
 */
export const issuePermit = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const officerId = req.user!.id;
    const { invoiceId, permitType, categoryId, businessId, validFrom } =
      req.body;

    // Confirm invoice is paid
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice)
      return sendError(res, "Invoice not found", "NOT_FOUND", null, 404);

    if (invoice.status !== "paid") {
      return sendError(
        res,
        "Invoice must be fully paid before a permit can be issued",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // Prevent duplicate permit issuance for same invoice
    const existingPermit = await prisma.permit.findUnique({
      where: { invoiceId },
    });
    if (existingPermit) {
      return sendError(
        res,
        "A permit has already been issued for this invoice",
        "CONFLICT",
        null,
        409,
      );
    }

    // Confirm business exists
    const business = await prisma.business.findUnique({
      where: { id: businessId, isActive: true },
    });
    if (!business)
      return sendError(res, "Business not found", "NOT_FOUND", null, 404);

    const levyConfig = await prisma.levyConfig.findFirst({
      where: { categoryId, isActive: true },
    });

    const startDate = validFrom ? new Date(validFrom) : new Date();
    const endDate = getPermitEndDate(
      startDate,
      levyConfig?.billingCycle ?? "yearly",
    );

    const permit = await prisma.permit.create({
      data: {
        permitNumber: generateReceiptNumber("PRM"),
        verificationCode: generateVerificationCode(),
        qrToken: generateQrToken(),
        status: "issued",
        // permitType,
        category: { connect: { id: categoryId } },
        validFrom: startDate,
        validTo: endDate,
        businessId,
        issuedById: officerId,
        invoice: { connect: { id: invoiceId } },
      },
      include: {
        business: {
          select: {
            id: true,
            businessName: true,
            ownerName: true,
            address: true,
          },
        },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "permit_issued",
        entity: "Permit",
        entityId: permit.id,
        userId: officerId,
        details: {
          permitType,
          categoryId,
          businessId,
          invoiceId,
          validTo: endDate,
        },
        ipAddress: getIp(req),
      },
    });

    // TODO Phase 7: Send permit via SMS/WhatsApp to business owner

    return sendSuccess(res, permit, "Permit issued successfully", 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/operations/field/permits
 * Field officer views permits in their assigned ward.
 * Scoped strictly to wardId on their user record.
 */
export const getWardPermits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const officerId = req.user!.id;
    const search    = queryString(req.query.search);
    const status    = queryString(req.query.status);

    // Get officer's assigned ward
    const officer = await prisma.user.findUnique({
      where: { id: officerId },
      // select: { wardId: true },
      include:{ward:true}
    });

    if (!officer?.ward.id) {
      return sendError(res, 'No ward assigned to your account', 'BAD_REQUEST', null, 400);
    }

    const where: any = {
      business: { wardId: officer?.ward.id },
    };

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { business: { businessName: { contains: search, mode: 'insensitive' } } },
        { business: { ownerName:    { contains: search, mode: 'insensitive' } } },
        { permitNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [permits, dailyCollections, inspectedCount] = await Promise.all([

      prisma.permit.findMany({
        where,
        include: {
          business: {
            select: {
              id: true, businessName: true, ownerName: true,
              phone: true, address: true, category: true,
            },
          },
          invoice: {
            select: { id: true, invoiceNumber: true, status: true, balanceDue: true, totalAmount: true },
          },
          config: { select: { baseAmount: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Daily collections — payments confirmed today by this officer
      prisma.payment.aggregate({
        where: {
          confirmedById: officerId,
          status: 'confirmed',
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        _sum: { amount: true },
      }),

      // Inspected shops — invoices this officer created
      prisma.invoice.count({
        where: {
          assignedOfficerId: officerId,
          business: { wardId: officer?.ward.id },
        },
      }),
    ]);

    // Shape to match UI fields exactly
    const shaped = permits.map((p) => {
      const isSettled  = ['issued'].includes(p.status);
      const outstanding = isSettled
        ? 0
        : Number(p.invoice?.balanceDue ?? p.config?.baseAmount ?? 0);

      return {
        id:           p.id,
        permitNumber: p.permitNumber,
        status:       p.status,
        validFrom:    p.validFrom,
        validTo:      p.validTo,
        outstanding,
        // Business info — UI reads these directly
        businessName: p.business.businessName,
        ownerName:    p.business.ownerName,
        phone:        p.business.phone,
        address:      p.business.address,
        category:     p.business.category,
        businessId:   p.business.id,
        // Invoice for pay now link
        invoiceId:        p.invoice?.id ?? null,
        invoiceNumber:    p.invoice?.invoiceNumber ?? null,
        invoiceStatus:    p.invoice?.status ?? null,
        // Config
        fee:          Number(p.config?.baseAmount ?? 0),
        permitType:   p.config?.name ?? '—',
      };
    });

    return sendSuccess(res, {
      permits: shaped,
      stats: {
        dailyCollections: Number(dailyCollections._sum.amount ?? 0),
        inspectedShops:   inspectedCount,
        wardId:           officer.ward.id,
        wardName: officer.ward.name
      },
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/operations/field/permits/:permitId/demand-notice
 * Field officer issues a demand notice (invoice) for an unpaid permit.
 * Only allowed if permit has no active unpaid invoice.
 */
export const issueDemandNotice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { permitId } = req.params;
    const officerId    = req.user!.id;

    const permit = await prisma.permit.findUnique({
      where: { id: String(permitId) },
      include: {
        business: { select: { id: true, businessName: true, wardId: true } },
        invoice:  { select: { id: true, status: true } },
        config:   { select: { baseAmount: true, categoryId: true } },
      },
    });

    if (!permit) return sendError(res, 'Permit not found', 'NOT_FOUND', null, 404);

    // Verify officer is in the same ward
    const officer = await prisma.user.findUnique({
      where: { id: officerId },
      select: { wardId: true },
    });

    if (officer?.wardId !== permit.business.wardId) {
      return sendError(res, 'This permit is not in your assigned ward', 'FORBIDDEN', null, 403);
    }

    if (permit.status === 'issued') {
      return sendError(res, 'Permit is already active — no demand notice needed', 'BAD_REQUEST', null, 400);
    }

    // Block if already has an unpaid invoice
    if (permit.invoice && ['sent', 'partially_paid', 'overdue'].includes(permit.invoice.status)) {
      return sendError(
        res,
        'An unpaid invoice already exists for this permit',
        'CONFLICT',
        null,
        409
      );
    }

    const amount = Number(permit.config?.baseAmount ?? 0);
    if (amount === 0) {
      return sendError(res, 'No pricing configured for this permit type', 'BAD_REQUEST', null, 400);
    }

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        categoryId:        permit.config!.categoryId,
        description:       `Demand Notice — ${permit.business.businessName} — ${permit.permitNumber}`,
        subtotal:          amount,
        totalAmount:       amount,
        balanceDue:        amount,
        status:            'sent',
        createdById:       officerId,
        assignedOfficerId: officerId,
        businessId:        permit.business.id,
        dueDate:           new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    // Link invoice to permit
    await prisma.permit.update({
      where: { id: String(permitId) },
      data:  { invoiceId: invoice.id },
    });

    await prisma.auditLog.create({
      data: {
        action:   'invoice_created',
        entity:   'Invoice',
        entityId: invoice.id,
        userId:   officerId,
        details:  { type: 'demand_notice', permitId, businessId: permit.business.id },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, { invoice, permit: permitId }, 'Demand notice issued', 201);
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/operations/field/violations
 * Field officer logs a business violation or unregistered business.
 */
export const logViolation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const officerId = req.user!.id;
    const {
      businessId,    // optional — if business already registered
      businessName,  // required if businessId not provided
      address,       // required if businessId not provided
      wardId,
      description,
      severity = 'minor',
    } = req.body;

    if (!description) {
      return sendError(res, 'Description is required', 'BAD_REQUEST', null, 400);
    }

    if (!businessId && !businessName) {
      return sendError(res, 'Either businessId or businessName is required', 'BAD_REQUEST', null, 400);
    }

    // Verify ward
    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) return sendError(res, 'Ward not found', 'NOT_FOUND', null, 404);

    // If businessId provided, verify it exists
    if (businessId) {
      const biz = await prisma.business.findUnique({ where: { id: businessId } });
      if (!biz) return sendError(res, 'Business not found', 'NOT_FOUND', null, 404);
    }

    const violation = await prisma.violation.create({
      data: {
        businessId:   businessId ?? null,
        businessName: businessId ? null : businessName,
        address:      businessId ? null : address,
        wardId,
        description,
        severity,
        status:      'open',
        loggedById:  officerId,
      },
      include: {
        business: { select: { businessName: true, address: true } },
        ward:     { select: { name: true } },
        loggedBy: { select: { firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action:   'complaint_raised', // closest existing action
        entity:   'Violation',
        entityId: violation.id,
        userId:   officerId,
        details:  { severity, businessName: businessId ? violation.business?.businessName : businessName },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, violation, 'Violation logged successfully', 201);
  } catch (err) { next(err); }
};



// ─────────────────────────────────────────────────────────────
// RECEIPT VERIFICATION
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/field-officer/receipts/verify/:code
 * Field officer verifies a receipt in the field by code or QR token.
 */
export const verifyReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // const { code } = req.params;
    const code = Array.isArray(req.params.code)
      ? req.params.code[0]
      : req.params.code;
    const officerId = req.user!.id;
    const cleanSearchCode = String(code).trim();

    const receipt = await prisma.receipt.findFirst({
      where: {
        OR: [
          { receiptNumber: cleanSearchCode }, // e.g., "RCP-2026-0001"
          { receiptNumber: cleanSearchCode.toUpperCase() },
          { verificationCode: code },
          { qrToken: code },
        ],
      },
      include: {
        invoice: {
          include: {
            business: {
              select: { businessName: true, ownerName: true, address: true },
            },
            category:true,
            payments:true
          },
        },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
        
      },
    });

    if (!receipt) {
      return sendError(
        res,
        "Receipt not found or invalid verification code",
        "NOT_FOUND",
        null,
        404,
      );
    }

    await prisma.auditLog.create({
      data: {
        action: "receipt_verified",
        entity: "Receipt",
        entityId: receipt.id,
        userId: officerId,
        details: { verificationCode: code },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, {
      valid: true,
      receiptNumber: receipt.receiptNumber,
      amountPaid: receipt.amountPaid,
      levyType:receipt.invoice.category.name,
      issuedAt: receipt.issuedAt,
      issuedBy: `${receipt.issuedBy.firstName} ${receipt.issuedBy.lastName}`,
      business: receipt.invoice.business
        ? {
            name: receipt.invoice.business.businessName,
            owner: receipt.invoice.business.ownerName,
            address: receipt.invoice.business.address,
          }
        : null,
      // category: receipt.invoice.category,
      issuingAuthority: "Ijebu North East Local Government",
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// DAILY COLLECTIONS DASHBOARD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/field-officer/collections
 * Field officer views their own collection history.
 * Scoped strictly to their own records — cannot see other officers.
 */
export const getMyCollections = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const officerId = req.user!.id;
    const date = queryString(req.query.date);
    // const category  = queryString(req.query.category) as RevenueCategory | undefined;
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "20");
    const skip = (page - 1) * limit;

    // Build date filter — default to today if no date provided
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const where: any = {
      assignedOfficerId: officerId,
      createdAt: { gte: startOfDay, lte: endOfDay },
      // ...(category && { category }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          business: {
            select: {
              id: true,
              businessName: true,
              ownerName: true,
              phone: true,
            },
          },
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
          receipt: {
            select: { id: true, receiptNumber: true, issuedAt: true },
          },
          permit: { select: { id: true, permitNumber: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.count({ where }),
    ]);

    // Daily summary totals
    const summary = await prisma.invoice.aggregate({
      where,
      _sum: { totalAmount: true, amountPaid: true },
      _count: { _all: true },
    });

    return sendSuccess(res, {
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        totalInvoiced: summary._sum.totalAmount ?? 0,
        totalCollected: summary._sum.amountPaid ?? 0,
        totalTransactions: summary._count._all,
        date: startOfDay,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/field-officer/collections/summary
 * Aggregate summary of officer's collections — used for dashboard widgets.
 */
export const getCollectionSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const officerId = req.user!.id;

    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));

    const [todaySummary, allTimeSummary, byCategory] = await Promise.all([
      // Today only
      prisma.invoice.aggregate({
        where: {
          assignedOfficerId: officerId,
          createdAt: { gte: startOfToday },
        },
        _sum: { amountPaid: true, totalAmount: true },
        _count: { _all: true },
      }),
      // All time
      prisma.invoice.aggregate({
        where: { assignedOfficerId: officerId },
        _sum: { amountPaid: true, totalAmount: true },
        _count: { _all: true },
      }),
      // Breakdown by category (all time)
      prisma.invoice.groupBy({
        by: ["categoryId"],
        where: { assignedOfficerId: officerId },
        _sum: { amountPaid: true },
        _count: { _all: true },
      }),
    ]);

    return sendSuccess(res, {
      today: {
        collected: todaySummary._sum.amountPaid ?? 0,
        invoiced: todaySummary._sum.totalAmount ?? 0,
        transactions: todaySummary._count._all,
      },
      allTime: {
        collected: allTimeSummary._sum.amountPaid ?? 0,
        invoiced: allTimeSummary._sum.totalAmount ?? 0,
        transactions: allTimeSummary._count._all,
      },
      byCategory: byCategory.map((c) => ({
        category: c.category,
        collected: c._sum.amountPaid ?? 0,
        transactions: c._count._all,
      })),
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
    case "daily":
      end.setDate(end.getDate() + 1);
      break;
    case "weekly":
      end.setDate(end.getDate() + 7);
      break;
    case "monthly":
      end.setMonth(end.getMonth() + 1);
      break;
    case "yearly":
      end.setFullYear(end.getFullYear() + 1);
      break;
    default:
      end.setFullYear(end.getFullYear() + 1);
  }
  return end;
};
