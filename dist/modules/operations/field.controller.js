"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionSummary = exports.getMyCollections = exports.verifyReceipt = exports.issuePermit = exports.recordPayment = exports.generateInvoice = exports.searchBusinesses = exports.registerBusiness = void 0;
const prisma_1 = require("../../utils/prisma");
const response_1 = require("../../utils/response");
const generators_1 = require("../../utils/generators");
const complaints_controller_1 = require("../complaints/complaints.controller");
// ─────────────────────────────────────────────────────────────
// BUSINESS REGISTRATION
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/field-officer/businesses
 * Field officer registers a business manually in the field.
 * Unlike business owner self-registration, officer can register
 * on behalf of any business — no one-per-owner restriction.
 */
const registerBusiness = async (req, res, next) => {
    try {
        const officerId = req.user.id;
        const { businessName, ownerName, address, phone, email, cacNumber, category, description, wardId, } = req.body;
        const ward = await prisma_1.prisma.ward.findUnique({ where: { id: wardId } });
        if (!ward)
            return (0, response_1.sendError)(res, 'Ward not found', 'NOT_FOUND', null, 404);
        // Check if a business with same name + phone already exists in this ward
        const duplicate = await prisma_1.prisma.business.findFirst({
            where: { phone, wardId, isActive: true },
        });
        if (duplicate) {
            return (0, response_1.sendError)(res, 'A business with this phone number already exists in this ward', 'CONFLICT', null, 409);
        }
        // Field officers register businesses under their own user ID as owner
        // This is intentional — the "owner" here is the registered business owner (person),
        // not a system user. The field officer is just the registrar.
        const business = await prisma_1.prisma.business.create({
            data: {
                businessName, ownerName, address, phone,
                email, cacNumber, category, description,
                wardId,
                ownerId: officerId, // field officer is the registrar/proxy owner in the system
            },
            include: { ward: { select: { id: true, name: true, code: true } } },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'user_created',
                entity: 'Business',
                entityId: business.id,
                userId: officerId,
                details: { businessName, ownerName, registeredByOfficer: true },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, business, 'Business registered successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.registerBusiness = registerBusiness;
/**
 * GET /api/v1/field-officer/businesses
 * Field officer searches for existing businesses before issuing a permit.
 */
const searchBusinesses = async (req, res, next) => {
    try {
        const search = (0, complaints_controller_1.queryString)(req.query.search);
        const wardId = (0, complaints_controller_1.queryString)(req.query.wardId);
        const page = parseInt((0, complaints_controller_1.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, complaints_controller_1.queryString)(req.query.limit) ?? '10');
        const skip = (page - 1) * limit;
        const where = { isActive: true };
        if (wardId)
            where.wardId = wardId;
        if (search) {
            where.OR = [
                { businessName: { contains: search, mode: 'insensitive' } },
                { ownerName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { cacNumber: { contains: search } },
            ];
        }
        const [businesses, total] = await Promise.all([
            prisma_1.prisma.business.findMany({
                where,
                skip,
                take: limit,
                include: {
                    ward: { select: { id: true, name: true } },
                    permits: {
                        where: { status: 'issued' },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { id: true, permitType: true, validTo: true, status: true },
                    },
                },
                orderBy: { businessName: 'asc' },
            }),
            prisma_1.prisma.business.count({ where }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            data: businesses,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.searchBusinesses = searchBusinesses;
// ─────────────────────────────────────────────────────────────
// INVOICE GENERATION
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/field-officer/invoices
 * Field officer generates an invoice for any levy category.
 * Treasurer's LevyConfig pricing is used automatically.
 * Officer can supply overrideAmount only if no config exists.
 */
const generateInvoice = async (req, res, next) => {
    try {
        const officerId = req.user.id;
        const { businessId, category, description, overrideAmount, quantity = 1 } = req.body;
        // Confirm business exists
        const business = await prisma_1.prisma.business.findUnique({
            where: { id: businessId, isActive: true },
            select: { id: true, businessName: true, ownerId: true },
        });
        if (!business)
            return (0, response_1.sendError)(res, 'Business not found', 'NOT_FOUND', null, 404);
        // Block if there is already an unpaid invoice of the same category for this business
        const unpaidInvoice = await prisma_1.prisma.invoice.findFirst({
            where: {
                businessId,
                category: category,
                status: { in: ['sent', 'draft', 'partially_paid'] },
            },
        });
        if (unpaidInvoice) {
            return (0, response_1.sendError)(res, 'This business already has an unpaid invoice for this category. Collect payment on the existing invoice first.', 'CONFLICT', null, 409);
        }
        // Fetch levy config — Treasurer's pricing takes precedence
        const levyConfig = await prisma_1.prisma.levyConfig.findFirst({
            where: { category: category, isActive: true },
        });
        let unitAmount;
        if (levyConfig) {
            unitAmount = Number(levyConfig.amount);
        }
        else if (overrideAmount) {
            unitAmount = overrideAmount;
        }
        else {
            return (0, response_1.sendError)(res, 'No levy configuration found for this category. Please provide an override amount or ask the Treasurer to configure pricing.', 'BAD_REQUEST', null, 400);
        }
        const subtotal = unitAmount * quantity;
        const totalAmount = subtotal; // penalties calculated separately later
        const invoice = await prisma_1.prisma.invoice.create({
            data: {
                category: category,
                description: description || `${category.replace(/_/g, ' ')} — ${business.businessName}`,
                subtotal,
                totalAmount,
                balanceDue: totalAmount,
                status: 'sent',
                levyConfigId: levyConfig?.id,
                createdById: officerId,
                assignedOfficerId: officerId,
                businessId,
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days for field collection
            },
            include: {
                business: { select: { id: true, businessName: true, ownerName: true, phone: true } },
                levyConfig: { select: { name: true, billingCycle: true } },
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'invoice_created',
                entity: 'Invoice',
                entityId: invoice.id,
                userId: officerId,
                details: { businessId, category, totalAmount, quantity },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, invoice, 'Invoice generated successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.generateInvoice = generateInvoice;
// ─────────────────────────────────────────────────────────────
// PAYMENT RECORDING
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/field-officer/payments
 * Field officer records a cash or POS payment against an invoice.
 * On full payment → receipt is auto-generated immediately.
 * On partial payment → invoice status set to partially_paid.
 */
const recordPayment = async (req, res, next) => {
    try {
        const officerId = req.user.id;
        const { invoiceId, amount, method, reference, narration } = req.body;
        const invoice = await prisma_1.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { business: { select: { id: true, businessName: true, ownerName: true } } },
        });
        if (!invoice)
            return (0, response_1.sendError)(res, 'Invoice not found', 'NOT_FOUND', null, 404);
        if (invoice.status === 'paid') {
            return (0, response_1.sendError)(res, 'This invoice has already been paid', 'BAD_REQUEST', null, 400);
        }
        if (invoice.status === 'cancelled') {
            return (0, response_1.sendError)(res, 'Cannot record payment on a cancelled invoice', 'BAD_REQUEST', null, 400);
        }
        const paymentAmount = Number(amount);
        const balanceDue = Number(invoice.balanceDue);
        if (paymentAmount > balanceDue) {
            return (0, response_1.sendError)(res, `Payment amount (${paymentAmount}) exceeds balance due (${balanceDue})`, 'BAD_REQUEST', null, 400);
        }
        const isFullPayment = paymentAmount >= balanceDue;
        const newAmountPaid = Number(invoice.amountPaid) + paymentAmount;
        const newBalanceDue = balanceDue - paymentAmount;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Record payment
            const payment = await tx.payment.create({
                data: {
                    invoiceId,
                    amount: paymentAmount,
                    method: method,
                    status: 'confirmed',
                    reference: reference || (0, generators_1.generateReference)('PAY'),
                    narration,
                    confirmedAt: new Date(),
                    confirmedById: officerId,
                    paidById: invoice.createdById,
                },
            });
            // 2. Update invoice totals and status
            const updatedInvoice = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    amountPaid: newAmountPaid,
                    balanceDue: newBalanceDue,
                    status: isFullPayment ? 'paid' : 'partially_paid',
                    paidAt: isFullPayment ? new Date() : null,
                },
            });
            // 3. Auto-generate receipt on full payment
            let receipt = null;
            if (isFullPayment) {
                receipt = await tx.receipt.create({
                    data: {
                        receiptNumber: (0, generators_1.generateReceiptNumber)('RCP'),
                        verificationCode: (0, generators_1.generateVerificationCode)(),
                        qrToken: (0, generators_1.generateQrToken)(),
                        amountPaid: newAmountPaid,
                        invoiceId,
                        issuedById: officerId,
                    },
                });
            }
            return { payment, invoice: updatedInvoice, receipt };
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'payment_confirmed',
                entity: 'Payment',
                entityId: result.payment.id,
                userId: officerId,
                details: {
                    invoiceId,
                    amount: paymentAmount,
                    method,
                    isFullPayment,
                    receiptId: result.receipt?.id ?? null,
                },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        if (result.receipt) {
            await prisma_1.prisma.auditLog.create({
                data: {
                    action: 'receipt_generated',
                    entity: 'Receipt',
                    entityId: result.receipt.id,
                    userId: officerId,
                    details: { invoiceId, receiptNumber: result.receipt.receiptNumber },
                    ipAddress: (0, complaints_controller_1.getIp)(req),
                },
            });
        }
        // TODO Phase 7: Send SMS/WhatsApp receipt to business owner
        return (0, response_1.sendSuccess)(res, {
            payment: result.payment,
            invoice: result.invoice,
            receipt: result.receipt,
            message: isFullPayment
                ? 'Full payment recorded. Receipt generated.'
                : `Partial payment recorded. Balance due: ₦${newBalanceDue}`,
        }, isFullPayment ? 'Payment confirmed and receipt issued' : 'Partial payment recorded');
    }
    catch (err) {
        next(err);
    }
};
exports.recordPayment = recordPayment;
// ─────────────────────────────────────────────────────────────
// PERMIT ISSUANCE
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/field-officer/permits
 * Field officer issues a permit immediately after payment is confirmed.
 * Invoice must be in 'paid' status before permit can be issued.
 */
const issuePermit = async (req, res, next) => {
    try {
        const officerId = req.user.id;
        const { invoiceId, permitType, category, businessId, validFrom } = req.body;
        // Confirm invoice is paid
        const invoice = await prisma_1.prisma.invoice.findUnique({
            where: { id: invoiceId },
        });
        if (!invoice)
            return (0, response_1.sendError)(res, 'Invoice not found', 'NOT_FOUND', null, 404);
        if (invoice.status !== 'paid') {
            return (0, response_1.sendError)(res, 'Invoice must be fully paid before a permit can be issued', 'BAD_REQUEST', null, 400);
        }
        // Prevent duplicate permit issuance for same invoice
        const existingPermit = await prisma_1.prisma.permit.findUnique({
            where: { invoiceId },
        });
        if (existingPermit) {
            return (0, response_1.sendError)(res, 'A permit has already been issued for this invoice', 'CONFLICT', null, 409);
        }
        // Confirm business exists
        const business = await prisma_1.prisma.business.findUnique({
            where: { id: businessId, isActive: true },
        });
        if (!business)
            return (0, response_1.sendError)(res, 'Business not found', 'NOT_FOUND', null, 404);
        const levyConfig = await prisma_1.prisma.levyConfig.findFirst({
            where: { category: category, isActive: true },
        });
        const startDate = validFrom ? new Date(validFrom) : new Date();
        const endDate = getPermitEndDate(startDate, levyConfig?.billingCycle ?? 'yearly');
        const permit = await prisma_1.prisma.permit.create({
            data: {
                permitNumber: (0, generators_1.generateReceiptNumber)('PRM'),
                verificationCode: (0, generators_1.generateVerificationCode)(),
                qrToken: (0, generators_1.generateQrToken)(),
                status: 'issued',
                permitType,
                category: category,
                validFrom: startDate,
                validTo: endDate,
                businessId,
                issuedById: officerId,
                invoiceId,
            },
            include: {
                business: { select: { id: true, businessName: true, ownerName: true, address: true } },
                issuedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'permit_issued',
                entity: 'Permit',
                entityId: permit.id,
                userId: officerId,
                details: { permitType, category, businessId, invoiceId, validTo: endDate },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        // TODO Phase 7: Send permit via SMS/WhatsApp to business owner
        return (0, response_1.sendSuccess)(res, permit, 'Permit issued successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.issuePermit = issuePermit;
// ─────────────────────────────────────────────────────────────
// RECEIPT VERIFICATION
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/field-officer/receipts/verify/:code
 * Field officer verifies a receipt in the field by code or QR token.
 */
const verifyReceipt = async (req, res, next) => {
    try {
        // const { code } = req.params;
        const code = Array.isArray(req.params.code)
            ? req.params.code[0]
            : req.params.code;
        const officerId = req.user.id;
        const receipt = await prisma_1.prisma.receipt.findFirst({
            where: {
                OR: [{ verificationCode: code }, { qrToken: code }],
            },
            include: {
                invoice: {
                    include: {
                        business: { select: { businessName: true, ownerName: true, address: true } },
                    },
                },
                issuedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        if (!receipt) {
            return (0, response_1.sendError)(res, 'Receipt not found or invalid verification code', 'NOT_FOUND', null, 404);
        }
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'receipt_verified',
                entity: 'Receipt',
                entityId: receipt.id,
                userId: officerId,
                details: { verificationCode: code },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, {
            valid: true,
            receiptNumber: receipt.receiptNumber,
            amountPaid: receipt.amountPaid,
            issuedAt: receipt.issuedAt,
            issuedBy: `${receipt.issuedBy.firstName} ${receipt.issuedBy.lastName}`,
            business: receipt.invoice.business
                ? {
                    name: receipt.invoice.business.businessName,
                    owner: receipt.invoice.business.ownerName,
                    address: receipt.invoice.business.address,
                }
                : null,
            category: receipt.invoice.category,
            issuingAuthority: 'Ijebu North East Local Government',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.verifyReceipt = verifyReceipt;
// ─────────────────────────────────────────────────────────────
// DAILY COLLECTIONS DASHBOARD
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/field-officer/collections
 * Field officer views their own collection history.
 * Scoped strictly to their own records — cannot see other officers.
 */
const getMyCollections = async (req, res, next) => {
    try {
        const officerId = req.user.id;
        const date = (0, complaints_controller_1.queryString)(req.query.date);
        const category = (0, complaints_controller_1.queryString)(req.query.category);
        const page = parseInt((0, complaints_controller_1.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, complaints_controller_1.queryString)(req.query.limit) ?? '20');
        const skip = (page - 1) * limit;
        // Build date filter — default to today if no date provided
        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
        const where = {
            assignedOfficerId: officerId,
            createdAt: { gte: startOfDay, lte: endOfDay },
            ...(category && { category }),
        };
        const [invoices, total] = await Promise.all([
            prisma_1.prisma.invoice.findMany({
                where,
                skip,
                take: limit,
                include: {
                    business: { select: { id: true, businessName: true, ownerName: true, phone: true } },
                    payments: { orderBy: { createdAt: 'desc' }, take: 1 },
                    receipt: { select: { id: true, receiptNumber: true, issuedAt: true } },
                    permit: { select: { id: true, permitNumber: true, status: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.invoice.count({ where }),
        ]);
        // Daily summary totals
        const summary = await prisma_1.prisma.invoice.aggregate({
            where,
            _sum: { totalAmount: true, amountPaid: true },
            _count: { _all: true },
        });
        return (0, response_1.sendSuccess)(res, {
            data: invoices,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
            summary: {
                totalInvoiced: summary._sum.totalAmount ?? 0,
                totalCollected: summary._sum.amountPaid ?? 0,
                totalTransactions: summary._count._all,
                date: startOfDay,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getMyCollections = getMyCollections;
/**
 * GET /api/v1/field-officer/collections/summary
 * Aggregate summary of officer's collections — used for dashboard widgets.
 */
const getCollectionSummary = async (req, res, next) => {
    try {
        const officerId = req.user.id;
        const today = new Date();
        const startOfToday = new Date(today.setHours(0, 0, 0, 0));
        const [todaySummary, allTimeSummary, byCategory] = await Promise.all([
            // Today only
            prisma_1.prisma.invoice.aggregate({
                where: { assignedOfficerId: officerId, createdAt: { gte: startOfToday } },
                _sum: { amountPaid: true, totalAmount: true },
                _count: { _all: true },
            }),
            // All time
            prisma_1.prisma.invoice.aggregate({
                where: { assignedOfficerId: officerId },
                _sum: { amountPaid: true, totalAmount: true },
                _count: { _all: true },
            }),
            // Breakdown by category (all time)
            prisma_1.prisma.invoice.groupBy({
                by: ['category'],
                where: { assignedOfficerId: officerId },
                _sum: { amountPaid: true },
                _count: { _all: true },
            }),
        ]);
        return (0, response_1.sendSuccess)(res, {
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
    }
    catch (err) {
        next(err);
    }
};
exports.getCollectionSummary = getCollectionSummary;
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
        default: end.setFullYear(end.getFullYear() + 1);
    }
    return end;
};
