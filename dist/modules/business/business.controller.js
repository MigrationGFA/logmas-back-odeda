"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPermit = exports.getMyInvoiceById = exports.getMyInvoices = exports.renewPermit = exports.getMyPermitById = exports.getMyPermits = exports.applyForPermit = exports.updateMyBusiness = exports.getMyBusiness = exports.createBusiness = void 0;
const prisma_1 = require("../../utils/prisma");
const response_1 = require("../../utils/response");
const generators_1 = require("../../utils/generators");
const complaints_controller_1 = require("../complaints/complaints.controller");
// ─────────────────────────────────────────────────────────────
// BUSINESS PROFILE
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/business
 * Business owner registers their business.
 * One active business per user enforced.
 */
const createBusiness = async (req, res, next) => {
    try {
        const ownerId = req.user.id;
        const { businessName, ownerName, address, phone, email, cacNumber, category, description, wardId } = req.body;
        // One active business per owner
        const existing = await prisma_1.prisma.business.findFirst({
            where: { ownerId, isActive: true },
        });
        if (existing) {
            return (0, response_1.sendError)(res, 'You already have an active registered business. Update it instead.', 'CONFLICT', null, 409);
        }
        const ward = await prisma_1.prisma.ward.findUnique({ where: { id: wardId } });
        if (!ward)
            return (0, response_1.sendError)(res, 'Ward not found', 'NOT_FOUND', null, 404);
        const business = await prisma_1.prisma.business.create({
            data: { businessName, ownerName, address, phone, email, cacNumber, category, description, wardId, ownerId },
            include: { ward: { select: { id: true, name: true } } },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'user_created', // closest available — business registration
                entity: 'Business',
                entityId: business.id,
                userId: ownerId,
                details: { businessName, category },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, business, 'Business registered successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createBusiness = createBusiness;
/**
 * GET /api/v1/business/my
 * Business owner views their own business profile.
 */
const getMyBusiness = async (req, res, next) => {
    try {
        const ownerId = req.user.id;
        const business = await prisma_1.prisma.business.findFirst({
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
            return (0, response_1.sendError)(res, 'No registered business found. Please register your business first.', 'NOT_FOUND', null, 404);
        }
        return (0, response_1.sendSuccess)(res, business);
    }
    catch (err) {
        next(err);
    }
};
exports.getMyBusiness = getMyBusiness;
/**
 * PATCH /api/v1/business/my
 * Business owner updates their own business profile.
 */
const updateMyBusiness = async (req, res, next) => {
    try {
        const ownerId = req.user.id;
        const business = await prisma_1.prisma.business.findFirst({
            where: { ownerId, isActive: true },
        });
        if (!business)
            return (0, response_1.sendError)(res, 'No active business found', 'NOT_FOUND', null, 404);
        const updated = await prisma_1.prisma.business.update({
            where: { id: business.id },
            data: req.body,
            include: { ward: { select: { id: true, name: true } } },
        });
        return (0, response_1.sendSuccess)(res, updated, 'Business profile updated');
    }
    catch (err) {
        next(err);
    }
};
exports.updateMyBusiness = updateMyBusiness;
// ─────────────────────────────────────────────────────────────
// TRADE PERMITS
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/business/permits
 * Business owner applies for a trade permit.
 * Creates permit (pending_payment) + invoice atomically.
 * Virtual account generation stubbed — wired in Phase 7.
 */
const applyForPermit = async (req, res, next) => {
    try {
        const ownerId = req.user.id;
        const { businessId, permitType, category, validFrom } = req.body;
        // Ownership check — business must belong to this owner
        const business = await prisma_1.prisma.business.findFirst({
            where: { id: businessId, ownerId, isActive: true },
        });
        if (!business) {
            return (0, response_1.sendError)(res, 'Business not found or does not belong to you', 'FORBIDDEN', null, 403);
        }
        // Block duplicate active permit of same type
        const activePermit = await prisma_1.prisma.permit.findFirst({
            where: {
                businessId,
                category: category,
                status: { in: ['pending_payment', 'issued'] },
            },
        });
        if (activePermit) {
            return (0, response_1.sendError)(res, 'An active or pending permit of this type already exists for this business', 'CONFLICT', null, 409);
        }
        // Fetch levy pricing configured by Treasurer
        const levyConfig = await prisma_1.prisma.levyConfig.findFirst({
            where: { category: category, isActive: true },
        });
        const totalAmount = levyConfig?.amount ?? 10000; // fallback until Treasurer configures
        // Calculate validity period from levy config billing cycle
        const startDate = validFrom ? new Date(validFrom) : new Date();
        const endDate = getPermitEndDate(startDate, levyConfig?.billingCycle ?? 'yearly');
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Create invoice first
            const invoice = await tx.invoice.create({
                data: {
                    category: category,
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
                    permitNumber: (0, generators_1.generateReceiptNumber)('PRM'),
                    verificationCode: (0, generators_1.generateVerificationCode)(),
                    qrToken: (0, generators_1.generateQrToken)(),
                    status: 'pending_payment',
                    permitType,
                    category: category,
                    validFrom: startDate,
                    validTo: endDate,
                    businessId,
                    issuedById: ownerId,
                    invoiceId: invoice.id,
                },
            });
            return { permit, invoice };
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'invoice_created',
                entity: 'Permit',
                entityId: result.permit.id,
                userId: ownerId,
                details: { permitType, category, businessId, invoiceId: result.invoice.id },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, {
            permit: result.permit,
            invoice: result.invoice,
            paymentNote: 'Invoice generated. Complete payment to activate your permit.',
        }, 'Permit application submitted. Proceed to payment.', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.applyForPermit = applyForPermit;
/**
 * GET /api/v1/business/permits
 * Business owner views all their permits.
 */
const getMyPermits = async (req, res, next) => {
    try {
        const ownerId = req.user.id;
        const business = await prisma_1.prisma.business.findFirst({
            where: { ownerId, isActive: true },
            select: { id: true },
        });
        if (!business)
            return (0, response_1.sendError)(res, 'No active business found', 'NOT_FOUND', null, 404);
        const permits = await prisma_1.prisma.permit.findMany({
            where: { businessId: business.id },
            include: {
                invoice: {
                    select: { id: true, status: true, totalAmount: true, balanceDue: true, paidAt: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return (0, response_1.sendSuccess)(res, permits);
    }
    catch (err) {
        next(err);
    }
};
exports.getMyPermits = getMyPermits;
/**
 * GET /api/v1/business/permits/:id
 * Business owner views a single permit — ownership enforced.
 */
const getMyPermitById = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const ownerId = req.user.id;
        const business = await prisma_1.prisma.business.findFirst({
            where: { ownerId, isActive: true },
            select: { id: true },
        });
        if (!business)
            return (0, response_1.sendError)(res, 'No active business found', 'NOT_FOUND', null, 404);
        const permit = await prisma_1.prisma.permit.findFirst({
            where: { id, businessId: business.id }, // ownership at query level
            include: {
                business: { select: { id: true, businessName: true, address: true } },
                invoice: true,
                issuedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        if (!permit)
            return (0, response_1.sendError)(res, 'Permit not found', 'NOT_FOUND', null, 404);
        return (0, response_1.sendSuccess)(res, permit);
    }
    catch (err) {
        next(err);
    }
};
exports.getMyPermitById = getMyPermitById;
/**
 * POST /api/v1/business/permits/:id/renew
 * Business owner renews an existing expired or issued permit.
 * Creates a new permit + new invoice for the renewal period.
 */
const renewPermit = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const ownerId = req.user.id;
        const { validFrom } = req.body;
        const business = await prisma_1.prisma.business.findFirst({
            where: { ownerId, isActive: true },
            select: { id: true, businessName: true },
        });
        if (!business)
            return (0, response_1.sendError)(res, 'No active business found', 'NOT_FOUND', null, 404);
        const existingPermit = await prisma_1.prisma.permit.findFirst({
            where: { id, businessId: business.id },
        });
        if (!existingPermit)
            return (0, response_1.sendError)(res, 'Permit not found', 'NOT_FOUND', null, 404);
        if (!['issued', 'expired'].includes(existingPermit.status)) {
            return (0, response_1.sendError)(res, 'Only issued or expired permits can be renewed', 'BAD_REQUEST', null, 400);
        }
        const levyConfig = await prisma_1.prisma.levyConfig.findFirst({
            where: { category: existingPermit.category, isActive: true },
        });
        const totalAmount = levyConfig?.amount ?? 10000;
        const startDate = validFrom ? new Date(validFrom) : new Date();
        const endDate = getPermitEndDate(startDate, levyConfig?.billingCycle ?? 'yearly');
        const result = await prisma_1.prisma.$transaction(async (tx) => {
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
                    permitNumber: (0, generators_1.generateReceiptNumber)('PRM'),
                    verificationCode: (0, generators_1.generateVerificationCode)(),
                    qrToken: (0, generators_1.generateQrToken)(),
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
        return (0, response_1.sendSuccess)(res, {
            permit: result.permit,
            invoice: result.invoice,
            paymentNote: 'Renewal invoice generated. Complete payment to activate.',
        }, 'Permit renewal initiated. Proceed to payment.');
    }
    catch (err) {
        next(err);
    }
};
exports.renewPermit = renewPermit;
// ─────────────────────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/business/invoices
 * Business owner views all invoices for their business.
 */
const getMyInvoices = async (req, res, next) => {
    try {
        const ownerId = req.user.id;
        const status = (0, complaints_controller_1.queryString)(req.query.status);
        const page = parseInt((0, complaints_controller_1.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, complaints_controller_1.queryString)(req.query.limit) ?? '10');
        const skip = (page - 1) * limit;
        const business = await prisma_1.prisma.business.findFirst({
            where: { ownerId, isActive: true },
            select: { id: true },
        });
        if (!business)
            return (0, response_1.sendError)(res, 'No active business found', 'NOT_FOUND', null, 404);
        const where = {
            businessId: business.id,
            ...(status && { status }),
        };
        const [invoices, total] = await Promise.all([
            prisma_1.prisma.invoice.findMany({
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
            prisma_1.prisma.invoice.count({ where }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            data: invoices,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getMyInvoices = getMyInvoices;
/**
 * GET /api/v1/business/invoices/:id
 * Business owner views a single invoice — ownership enforced via business link.
 */
const getMyInvoiceById = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const ownerId = req.user.id;
        const business = await prisma_1.prisma.business.findFirst({
            where: { ownerId, isActive: true },
            select: { id: true },
        });
        if (!business)
            return (0, response_1.sendError)(res, 'No active business found', 'NOT_FOUND', null, 404);
        const invoice = await prisma_1.prisma.invoice.findFirst({
            where: { id, businessId: business.id }, // ownership at query level
            include: {
                levyConfig: { select: { name: true, category: true, billingCycle: true } },
                payments: { orderBy: { createdAt: 'desc' } },
                receipt: true,
                permit: { select: { id: true, permitNumber: true, status: true, validFrom: true, validTo: true } },
            },
        });
        if (!invoice)
            return (0, response_1.sendError)(res, 'Invoice not found', 'NOT_FOUND', null, 404);
        return (0, response_1.sendSuccess)(res, invoice);
    }
    catch (err) {
        next(err);
    }
};
exports.getMyInvoiceById = getMyInvoiceById;
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
const verifyPermit = async (req, res, next) => {
    try {
        // FIX #1: Ensure code is a string (Express params can be string[])
        const code = Array.isArray(req.params.code)
            ? req.params.code[0]
            : req.params.code;
        if (!code) {
            return (0, response_1.sendError)(res, 'Verification code is required', 'BAD_REQUEST', null, 400);
        }
        // FIX #2: Use explicit typing for Prisma query with include
        const permit = await prisma_1.prisma.permit.findFirst({
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
            return (0, response_1.sendError)(res, 'Permit not found or invalid verification code', 'NOT_FOUND', null, 404);
        }
        // Safety check: business relation might be null if not loaded
        if (!permit.business) {
            return (0, response_1.sendError)(res, 'Permit data incomplete', 'INTERNAL_ERROR', null, 500);
        }
        const now = new Date();
        const isExpired = permit.validTo ? permit.validTo < now : false;
        const isValid = permit.status === 'issued' && !isExpired;
        return (0, response_1.sendSuccess)(res, {
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
    }
    catch (err) {
        next(err);
    }
};
exports.verifyPermit = verifyPermit;
// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const getPermitEndDate = (startDate, billingCycle) => {
    const end = new Date(startDate);
    switch (billingCycle) {
        case 'daily':
            end.setDate(end.getDate() + 1);
            break;
        case 'weekly':
            end.setDate(end.getDate() + 7);
            break;
        case 'monthly':
            end.setMonth(end.getMonth() + 1);
            break;
        case 'yearly':
            end.setFullYear(end.getFullYear() + 1);
            break;
        default: end.setFullYear(end.getFullYear() + 1); // default to yearly
    }
    return end;
};
