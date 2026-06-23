// src/modules/business/business.controller.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../../utils/prisma";
import { sendSuccess, sendError } from "../../utils/response";
import {
  generateReceiptNumber,
  generateVerificationCode,
  generateQrToken,
} from "../../utils/generators";
import { InvoiceStatus, RevenueCategory, Role } from "@prisma/client";
import { getIp, queryString } from "../complaints/complaints.controller";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────
// BUSINESS PROFILE
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/business
 * Business owner registers their business.
 * One active business per user enforced.
 */
export const createBusiness = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actorId = req.user!.id;
    const actorRole = req.user!.role;

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
      ownerPhone,
      email: ownerEmail,
      existingUserId,
    } = req.body;

    // 1. Structural Validation up front
    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) return sendError(res, "Ward not found", "NOT_FOUND", null, 404);

    let targetOwnerId: string;

    // ─────────────────────────────────────────────────────
    // CITIZEN / BUSINESS OWNER — self-registration
    // ─────────────────────────────────────────────────────
    if (actorRole === Role.citizen || actorRole === Role.business_owner) {
      const existing = await prisma.business.findFirst({
        where: { ownerId: actorId, isActive: true },
      });
      if (existing) {
        return sendError(
          res,
          "You already have an active business profile registered.",
          "CONFLICT",
          null,
          409,
        );
      }
      targetOwnerId = actorId;
    }
    // ─────────────────────────────────────────────────────
    // FIELD ENFORCEMENT & ADMINISTRATIVE HUB ONBOARDING
    // ─────────────────────────────────────────────────────
    else if (
      actorRole === Role.field_officer ||
      actorRole === Role.super_admin ||
      actorRole === Role.lga_admin
    ) {
      if (existingUserId) {
        const existingUser = await prisma.user.findUnique({
          where: { id: existingUserId, deletedAt: null },
          select: { id: true },
        });
        if (!existingUser) {
          return sendError(
            res,
            "Specified user account not found in system registers",
            "NOT_FOUND",
            null,
            404,
          );
        }
        targetOwnerId = existingUserId;
      } else {
        // Enforce fallback boundaries for walk-in cash-paying merchants
        const contactPhone = ownerPhone || phone;
        const contactName = ownerName;

        if (!contactName || !contactPhone) {
          return sendError(
            res,
            "Owner name and phone number are required to register an unauthenticated street merchant",
            "BAD_REQUEST",
            null,
            400,
          );
        }

        // Clean name parsing safely
        const nameParts = contactName.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || "Walk-In";

        // 🚀 EXECUTE ATOMIC TRANSIT TRANSACTION
        // This ensures lookup-or-create runs smoothly without race condition crashes
        const finalOwner = await prisma.$transaction(async (tx) => {
          const existingByPhone = await tx.user.findFirst({
            where: { phone: contactPhone },
            select: { id: true },
          });

          if (existingByPhone) {
            return existingByPhone;
          }

          // Build locked-down user object mapping tree
          const secureTempPassword = await bcrypt.hash(crypto.randomUUID(), 12);

          return await tx.user.create({
            data: {
              firstName,
              lastName,
              phone: contactPhone,
              email: ownerEmail || null,
              password: secureTempPassword,
              role: Role.citizen,
              isWalkIn: true,
              walkInRegisteredById: actorId,
              wardId,
            },
          });
        });

        targetOwnerId = finalOwner.id;
      }
    } else {
      return sendError(
        res,
        "Your role is unauthorized to register operational properties",
        "FORBIDDEN",
        null,
        403,
      );
    }

    // ─────────────────────────────────────────────────────
    // WRITE INTEGRATED BUSINESS BLOCK ATOMICALLY
    // ─────────────────────────────────────────────────────
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
        ownerId: targetOwnerId,
      },
      include: {
        ward: { select: { id: true, name: true } },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            isWalkIn: true,
          },
        },
      },
    });

    // Log the transaction track
    await prisma.auditLog.create({
      data: {
        action: "user_created",
        entity: "Business",
        entityId: business.id,
        userId: actorId,
        details: {
          businessName,
          category,
          registeredByRole: actorRole,
          targetOwnerId,
          isWalkIn: business.owner.isWalkIn,
        },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(
      res,
      business,
      "Business entity registered successfully onto local registers",
      201,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/business/my
 * Business owner views their own business profile.
 */
export const getMyBusiness = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const ownerId = req.user!.id;

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
      include: {
        ward: { select: { id: true, name: true, code: true } },
        permits: {
          where: { status: { in: ["issued", "pending_payment"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            status: true,
            validFrom: true,
            validTo: true,
            config: true,
            id: true,
            permitNumber: true,
          },
        },
      },
    });

    if (!business) {
      return sendError(
        res,
        "No registered business found. Please register your business first.",
        "NOT_FOUND",
        null,
        404,
      );
    }

    const formattedPermits = business.permits.map((p) => ({
      id: p.id,
      permitNumber: p.permitNumber,
      permitType: p.config.name, // Injected from layout config name
      status: p.status,
      validFrom: p.validFrom,
      validTo: p.validTo,
    }));

    return sendSuccess(res, { ...business, permits: formattedPermits });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/business/my
 * Business owner updates their own business profile.
 */
export const updateMyBusiness = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const ownerId = req.user!.id;

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
    });
    if (!business)
      return sendError(res, "No active business found", "NOT_FOUND", null, 404);

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: req.body,
      include: { ward: { select: { id: true, name: true } } },
    });

    return sendSuccess(res, updated, "Business profile updated");
  } catch (err) {
    next(err);
  }
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

export const applyForPermit = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actorId = req.user!.id;
    const actorRole = req.user!.role;
    const { businessId, categoryId, validFrom } = req.body;

    // 1. Fetch the exact permit configuration created by the Treasurer
    const permitConfig = await prisma.permitConfig.findFirst({
      where: { categoryId: categoryId, isActive: true },
    });
    if (!permitConfig) {
      return sendError(
        res,
        "Active permit configuration profile not found",
        "NOT_FOUND",
        null,
        404,
      );
    }

    // 2. Dynamic Business Ownership & Existence Check
    const businessWhere: any = { id: businessId, isActive: true };

    // Strict ownership boundary only for standard citizens/owners
    if (actorRole === Role.citizen || actorRole === Role.business_owner) {
      businessWhere.ownerId = actorId;
    }

    const business = await prisma.business.findFirst({ where: businessWhere });

    if (!business) {
      const errorMsg =
        actorRole === Role.citizen || actorRole === Role.business_owner
          ? "Business not found or does not belong to you"
          : "Target business profile not found or is currently inactive";
      return sendError(res, errorMsg, "FORBIDDEN", null, 403);
    }

    // 3. Block duplicates using the dynamic config tracker
    const activePermit = await prisma.permit.findFirst({
      where: {
        businessId,
        configId: permitConfig.id,
        status: { in: ["pending_payment", "issued"] },
      },
    });
    if (activePermit) {
      return sendError(
        res,
        "An active or pending permit of this specific matrix tier already exists",
        "CONFLICT",
        null,
        409,
      );
    }

    const totalAmount = Number(permitConfig.baseAmount);
    const startDate = validFrom ? new Date(validFrom) : new Date();
    const endDate = getPermitEndDate(startDate, "yearly");

    // 4. Atomic Database Writes
    const result = await prisma.$transaction(async (tx) => {
      // Create billing reference (createdById tracks the active officer or citizen)
      const invoice = await tx.invoice.create({
        data: {
          categoryId: permitConfig.categoryId,
          description: `${permitConfig.name} — ${business.businessName}`,
          subtotal: totalAmount,
          totalAmount,
          balanceDue: totalAmount,
          status: "sent",
          createdById: actorId,
          businessId,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Create permit document framework link
      const permit = await tx.permit.create({
        data: {
          permitNumber: generateReceiptNumber("PRM"),
          verificationCode: generateVerificationCode(),
          qrToken: generateQrToken(),
          status: "pending_payment",
          configId: permitConfig.id,
          categoryId: permitConfig.categoryId,
          validFrom: startDate,
          validTo: endDate,
          businessId,
          issuedById: actorId, // Tracks which officer handed it out on the field
          invoiceId: invoice.id,
        },
      });

      return { permit, invoice };
    });

    // 5. System Audit Log Tracking
    await prisma.auditLog.create({
      data: {
        action: "invoice_created",
        entity: "Permit",
        entityId: result.permit.id,
        userId: actorId,
        details: {
          configId: permitConfig.id,
          businessId,
          invoiceId: result.invoice.id,
          initiatedByRole: actorRole,
        },
        ipAddress: getIp(req),
      },
    });

    const successMessage =
      actorRole === Role.field_officer
        ? "Permit processed successfully. Forwarding to payment collection panel..."
        : "Permit application submitted successfully. Proceed to payment.";

    return sendSuccess(res, result, successMessage, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/business/permits
 * Business owner views all their permits.
 */
export const getMyPermits = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const ownerId = req.user!.id;

    // 1. Fetch all active businesses owned by this user
    const businesses = await prisma.business.findMany({
      where: { ownerId, deletedAt: null },
      select: { id: true, businessName: true },
    });

    console.log(businesses, "♾️");
    if (!businesses.length) {
      return sendSuccess(res, []); // Return empty array so UI handles <EmptyState> cleanly
    }

    const businessIds = businesses.map((b) => b.id);
    // Create a fast lookup map for business names
    const businessNameMap = new Map(
      businesses.map((b) => [b.id, b.businessName]),
    );

    // 2. Fetch all permits tied to any of those businesses
    const permits = await prisma.permit.findMany({
      where: {
        businessId: { in: businessIds },
      },
      include: {
        invoice: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            balanceDue: true,
          },
        },
        config: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. Shape the response payload data so it matches the exact property structure the frontend components read
    const formattedPermits = permits.map((p) => ({
      id: p.id,
      permitNumber: p.permitNumber,
      permitType: p.config?.name ?? "Trade Permit",
      status: p.status, // e.g. "issued", "pending"
      issueDate: p.validFrom,
      expiryDate: p.validTo,
      qrToken: p.qrToken ?? `VERIFY-${p.permitNumber}`,

      // Inject parameters the frontend assumes exist on the root object
      businessName: businessNameMap.get(p.businessId) || "Unknown Business",
      fee: Number(p.invoice?.totalAmount ?? 0),
      invoiceId: p.invoice?.id ?? null,

      // Keep nested invoice relation structure intact just in case
      invoice: p.invoice,
    }));

    // console.log(formattedPermits,"formattedPermits❤️");

    return sendSuccess(res, { data: formattedPermits });
  } catch (err) {
    next(err);
  }
};
/**
 * GET /api/v1/business/permits/:id
 * Business owner views a single permit — ownership enforced.
 */
export const getMyPermitById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const actorId = req.user!.id;
    const actorRole = req.user!.role;

    // 1. Establish strict access conditions based on security clearances
    const permitWhere: any = { id };

    // CITIZEN / OWNER FLOW: Strict tenant-isolation containment
    if (actorRole === Role.citizen || actorRole === Role.business_owner) {
      permitWhere.business = {
        ownerId: actorId,
      };
    }
    // FIELD OFFICER FLOW: Scope visibility to their designated territory
    else if (actorRole === Role.field_officer) {
      const officer = await prisma.user.findUnique({
        where: { id: actorId },
        select: { wardId: true },
      });

      // Officers can view if they manually raised it OR if the business lives in their ward
      permitWhere.OR = [
        { issuedById: actorId },
        ...(officer?.wardId ? [{ business: { wardId: officer.wardId } }] : []),
      ];
    }
    // WARD COUNCILLOR FLOW: Locked down to their exact geographic ward
    else if (actorRole === Role.ward_councillor) {
      const councillor = await prisma.user.findUnique({
        where: { id: actorId },
        select: { wardId: true },
      });

      if (!councillor?.wardId) {
        return sendError(
          res,
          "Councillor profile has no assigned ward",
          "FORBIDDEN",
          null,
          403,
        );
      }
      permitWhere.business = { wardId: councillor.wardId };
    }
    // LGA_ADMIN & SUPER_ADMIN FLOW: Bypass filtering entirely (global view read)

    // 2. Query data with optimized relative include blocks
    const permit = await prisma.permit.findFirst({
      where: permitWhere,
      include: {
        business: {
          select: {
            id: true,
            businessName: true,
            address: true,
            wardId: true,
            category: true,
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        invoice: {
          select: {
            amountPaid: true,
            totalAmount: true,
            id: true,
            balanceDue: true,
            invoiceNumber: true,
            status: true,
          },
        },
        issuedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        config: { select: { id: true, name: true } },
      },
    });

    if (!permit) {
      return sendError(
        res,
        "Permit record not found or access unauthorized",
        "NOT_FOUND",
        null,
        404,
      );
    }

    return sendSuccess(res, permit);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/business/permits/:id/renew
 * Business owner renews an existing expired or issued permit.
 * Creates a new permit + new invoice for the renewal period.
 */
export const renewPermit = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const ownerId = req.user!.id;
    const { validFrom } = req.body;

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
      select: { id: true, businessName: true },
    });
    if (!business)
      return sendError(res, "No active business found", "NOT_FOUND", null, 404);

    const existingPermit = await prisma.permit.findFirst({
      where: { id, businessId: business.id },
      include: { config: true },
    });
    if (!existingPermit)
      return sendError(res, "Permit not found", "NOT_FOUND", null, 404);

    if (!["issued", "expired"].includes(existingPermit.status)) {
      return sendError(
        res,
        "Only issued or expired permits can be renewed",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const totalAmount = Number(existingPermit.config.baseAmount);
    const startDate = validFrom ? new Date(validFrom) : new Date();
    const endDate = getPermitEndDate(startDate, "yearly");

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          categoryId: existingPermit.categoryId,
          description: `Permit Renewal — ${existingPermit.config.name} — ${business.businessName}`,
          subtotal: totalAmount,
          totalAmount,
          balanceDue: totalAmount,
          status: "sent",
          createdById: ownerId,
          businessId: business.id,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const renewedPermit = await tx.permit.create({
        data: {
          permitNumber: generateReceiptNumber("PRM"),
          verificationCode: generateVerificationCode(),
          qrToken: generateQrToken(),
          status: "pending_payment",
          configId: existingPermit.configId,
          categoryId: existingPermit.categoryId,
          validFrom: startDate,
          validTo: endDate,
          businessId: business.id,
          issuedById: ownerId,
          invoiceId: invoice.id,
        },
      });

      await tx.permit.update({
        where: { id: existingPermit.id },
        data: { status: "expired" },
      });

      return { permit: renewedPermit, invoice };
    });

    return sendSuccess(
      res,
      result,
      "Permit renewal initiated. Proceed to payment.",
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/business/invoices
 * Business owner views all invoices for their business.
 */
export const getMyInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const ownerId = req.user!.id;
    const status = queryString(req.query.status) as InvoiceStatus | undefined;
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "10");
    const skip = (page - 1) * limit;
    // console.log("✅")

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
      select: { id: true },
    });
    if (!business)
      return sendError(res, "No active business found", "NOT_FOUND", null, 404);

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
          receipt: {
            select: { id: true, receiptNumber: true, issuedAt: true },
          },
          permit: { select: { id: true, permitNumber: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.count({ where }),
    ]);

    return sendSuccess(res, {
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/business/invoices/:id
 * Business owner views a single invoice — ownership enforced via business link.
 */
export const getMyInvoiceById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const ownerId = req.user!.id;

    const business = await prisma.business.findFirst({
      where: { ownerId, isActive: true },
      select: { id: true },
    });
    if (!business)
      return sendError(res, "No active business found", "NOT_FOUND", null, 404);

    const invoice = await prisma.invoice.findFirst({
      where: { id, businessId: business.id }, // ownership at query level
      include: {
        levyConfig: {
          select: { name: true, category: true, billingCycle: true },
        },
        payments: { orderBy: { createdAt: "desc" } },
        receipt: true,
        permit: {
          select: {
            id: true,
            permitNumber: true,
            status: true,
            validFrom: true,
            validTo: true,
          },
        },
      },
    });

    if (!invoice)
      return sendError(res, "Invoice not found", "NOT_FOUND", null, 404);

    return sendSuccess(res, invoice);
  } catch (err) {
    next(err);
  }
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
export const verifyPermit = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const code = Array.isArray(req.params.code)
      ? req.params.code[0]
      : req.params.code;
    if (!code)
      return sendError(
        res,
        "Verification code is required",
        "BAD_REQUEST",
        null,
        400,
      );

    const permit = await prisma.permit.findFirst({
      where: {
        OR: [{ verificationCode: code }, { qrToken: code }],
      },
      include: {
        config: { select: { name: true } }, // Resolve configuration name string
        business: {
          select: {
            businessName: true,
            ownerName: true,
            address: true,
            category: true,
            ward: { select: { name: true } },
          },
        },
      },
    });

    if (!permit || !permit.business) {
      return sendError(
        res,
        "Permit invalid or system records match missing",
        "NOT_FOUND",
        null,
        404,
      );
    }

    const now = new Date();
    const isExpired = permit.validTo ? permit.validTo < now : false;
    const isValid = permit.status === "issued" && !isExpired;

    return sendSuccess(res, {
      valid: isValid,
      status: permit.status,
      isExpired,
      permitNumber: permit.permitNumber,
      permitType: permit.config.name, // Pull name directly from config relation
      categoryId: permit.categoryId,
      validFrom: permit.validFrom,
      validTo: permit.validTo,
      issuedAt: permit.createdAt,
      business: {
        name: permit.business.businessName,
        owner: permit.business.ownerName,
        address: permit.business.address,
        category: permit.business.category,
        ward: permit.business.ward?.name || "Unknown",
      },
      issuingAuthority: "Ijebu North East Local Government",
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
      end.setFullYear(end.getFullYear() + 1); // default to yearly
  }
  return end;
};
