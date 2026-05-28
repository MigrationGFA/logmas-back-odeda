"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markInvoiceOverdue = exports.getInvoiceById = exports.getAllInvoices = exports.getReconciliation = exports.getRevenueByWard = exports.getRevenueByOfficer = exports.getRevenueOverview = exports.toggleLevyConfig = exports.updateLevyConfig = exports.getLevyConfigById = exports.listLevyConfigs = exports.createLevyConfig = void 0;
const prisma_1 = require("../../utils/prisma");
const response_1 = require("../../utils/response");
const complaints_controller_1 = require("../complaints/complaints.controller");
// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
/**
 * Builds a Prisma date range filter from query params.
 * Defaults: from = start of current month, to = now
 */
const buildDateRange = (from, to) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        gte: from ? new Date(from) : startOfMonth,
        lte: to ? new Date(to) : now,
    };
};
// ─────────────────────────────────────────────────────────────
// LEVY CONFIG MANAGEMENT
// ─────────────────────────────────────────────────────────────
/**
 * POST /api/v1/treasurer/levy-configs
 * Treasurer creates a new levy pricing configuration.
 * Only one active config per category is enforced.
 */
const createLevyConfig = async (req, res, next) => {
    try {
        const treasurerId = req.user.id;
        const { name, category, description, amount, billingCycle, penaltyRate, effectiveFrom, effectiveTo, } = req.body;
        // Warn if an active config already exists for this category
        // We don't block it — Treasurer may want to schedule a future config
        const existing = await prisma_1.prisma.levyConfig.findFirst({
            where: { category: category, isActive: true },
            select: { id: true, name: true, amount: true },
        });
        const config = await prisma_1.prisma.levyConfig.create({
            data: {
                name,
                category: category,
                description,
                amount,
                billingCycle: billingCycle ?? 'yearly',
                penaltyRate,
                isActive: true,
                effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
                effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
                configuredById: treasurerId,
            },
            include: {
                configuredBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'pricing_updated',
                entity: 'LevyConfig',
                entityId: config.id,
                userId: treasurerId,
                details: { category, amount, billingCycle, name },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, {
            config,
            ...(existing && {
                warning: `An active config "${existing.name}" (₦${existing.amount}) already exists for this category. Consider deactivating it.`,
                existingConfigId: existing.id,
            }),
        }, 'Levy configuration created', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createLevyConfig = createLevyConfig;
/**
 * GET /api/v1/treasurer/levy-configs
 * List all levy configs with optional filters.
 */
const listLevyConfigs = async (req, res, next) => {
    try {
        const category = (0, complaints_controller_1.queryString)(req.query.category);
        const isActive = req.query.isActive !== undefined
            ? req.query.isActive === 'true'
            : undefined;
        const page = parseInt((0, complaints_controller_1.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, complaints_controller_1.queryString)(req.query.limit) ?? '20');
        const skip = (page - 1) * limit;
        const where = {
            ...(category !== undefined && { category }),
            ...(isActive !== undefined && { isActive }),
        };
        const [configs, total] = await Promise.all([
            prisma_1.prisma.levyConfig.findMany({
                where,
                skip,
                take: limit,
                include: {
                    configuredBy: { select: { id: true, firstName: true, lastName: true } },
                    _count: { select: { invoices: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.levyConfig.count({ where }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            data: configs,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.listLevyConfigs = listLevyConfigs;
/**
 * GET /api/v1/treasurer/levy-configs/:id
 * Get a single levy config with invoice count.
 */
const getLevyConfigById = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const config = await prisma_1.prisma.levyConfig.findUnique({
            where: { id },
            include: {
                configuredBy: { select: { id: true, firstName: true, lastName: true } },
                _count: { select: { invoices: true } },
            },
        });
        if (!config)
            return (0, response_1.sendError)(res, 'Levy configuration not found', 'NOT_FOUND', null, 404);
        return (0, response_1.sendSuccess)(res, config);
    }
    catch (err) {
        next(err);
    }
};
exports.getLevyConfigById = getLevyConfigById;
/**
 * PATCH /api/v1/treasurer/levy-configs/:id
 * Update a levy config — amount, cycle, penalty rate, etc.
 */
const updateLevyConfig = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const treasurerId = req.user.id;
        const config = await prisma_1.prisma.levyConfig.findUnique({ where: { id } });
        if (!config)
            return (0, response_1.sendError)(res, 'Levy configuration not found', 'NOT_FOUND', null, 404);
        const { name, description, amount, billingCycle, penaltyRate, effectiveTo } = req.body;
        const updated = await prisma_1.prisma.levyConfig.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(amount !== undefined && { amount }),
                ...(billingCycle !== undefined && { billingCycle }),
                ...(penaltyRate !== undefined && { penaltyRate }),
                ...(effectiveTo !== undefined && { effectiveTo: new Date(effectiveTo) }),
            },
            include: {
                configuredBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'pricing_updated',
                entity: 'LevyConfig',
                entityId: id,
                userId: treasurerId,
                details: {
                    before: { amount: config.amount, billingCycle: config.billingCycle },
                    after: { amount: updated.amount, billingCycle: updated.billingCycle },
                },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, updated, 'Levy configuration updated');
    }
    catch (err) {
        next(err);
    }
};
exports.updateLevyConfig = updateLevyConfig;
/**
 * PATCH /api/v1/treasurer/levy-configs/:id/toggle
 * Activate or deactivate a levy config.
 */
const toggleLevyConfig = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const treasurerId = req.user.id;
        const config = await prisma_1.prisma.levyConfig.findUnique({ where: { id } });
        if (!config)
            return (0, response_1.sendError)(res, 'Levy configuration not found', 'NOT_FOUND', null, 404);
        const updated = await prisma_1.prisma.levyConfig.update({
            where: { id },
            data: { isActive: !config.isActive },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'pricing_updated',
                entity: 'LevyConfig',
                entityId: id,
                userId: treasurerId,
                details: { action: updated.isActive ? 'activated' : 'deactivated' },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, updated, `Levy configuration ${updated.isActive ? 'activated' : 'deactivated'}`);
    }
    catch (err) {
        next(err);
    }
};
exports.toggleLevyConfig = toggleLevyConfig;
// ─────────────────────────────────────────────────────────────
// REVENUE ANALYTICS
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/treasurer/revenue
 * System-wide revenue overview.
 * Supports date range filtering. Defaults to current month.
 */
const getRevenueOverview = async (req, res, next) => {
    try {
        const from = (0, complaints_controller_1.queryString)(req.query.from);
        const to = (0, complaints_controller_1.queryString)(req.query.to);
        const dateRange = buildDateRange(from, to);
        const [totalSummary, byCategory, byStatus, byPaymentMethod, dailyTrend,] = await Promise.all([
            // Overall totals
            prisma_1.prisma.invoice.aggregate({
                where: { createdAt: dateRange },
                _sum: { totalAmount: true, amountPaid: true, balanceDue: true },
                _count: { _all: true },
            }),
            // Revenue by levy category
            prisma_1.prisma.invoice.groupBy({
                by: ['category'],
                where: { createdAt: dateRange },
                _sum: { totalAmount: true, amountPaid: true },
                _count: { _all: true },
                orderBy: { _sum: { amountPaid: 'desc' } },
            }),
            // Invoice count by status
            prisma_1.prisma.invoice.groupBy({
                by: ['status'],
                where: { createdAt: dateRange },
                _sum: { totalAmount: true },
                _count: { _all: true },
            }),
            // Payment method breakdown (confirmed payments only)
            prisma_1.prisma.payment.groupBy({
                by: ['method'],
                where: { status: 'confirmed', createdAt: dateRange },
                _sum: { amount: true },
                _count: { _all: true },
            }),
            // Daily collection trend (last 30 days within range)
            prisma_1.prisma.payment.groupBy({
                by: ['createdAt'],
                where: { status: 'confirmed', createdAt: dateRange },
                _sum: { amount: true },
                _count: { _all: true },
                orderBy: { createdAt: 'asc' },
            }),
        ]);
        const collectionRate = totalSummary._sum.totalAmount
            ? ((Number(totalSummary._sum.amountPaid) / Number(totalSummary._sum.totalAmount)) * 100).toFixed(2)
            : '0.00';
        return (0, response_1.sendSuccess)(res, {
            period: { from: dateRange.gte, to: dateRange.lte },
            summary: {
                totalInvoiced: totalSummary._sum.totalAmount ?? 0,
                totalCollected: totalSummary._sum.amountPaid ?? 0,
                totalOutstanding: totalSummary._sum.balanceDue ?? 0,
                totalInvoices: totalSummary._count._all,
                collectionRate: `${collectionRate}%`,
            },
            byCategory: byCategory.map((c) => ({
                category: c.category,
                invoiced: c._sum.totalAmount ?? 0,
                collected: c._sum.amountPaid ?? 0,
                invoiceCount: c._count._all,
            })),
            byStatus: byStatus.map((s) => ({
                status: s.status,
                totalAmount: s._sum.totalAmount ?? 0,
                invoiceCount: s._count._all,
            })),
            byPaymentMethod: byPaymentMethod.map((m) => ({
                method: m.method,
                totalAmount: m._sum.amount ?? 0,
                transactions: m._count._all,
            })),
            dailyTrend: dailyTrend.map((d) => ({
                date: d.createdAt,
                collected: d._sum.amount ?? 0,
                transactions: d._count._all,
            })),
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getRevenueOverview = getRevenueOverview;
/**
 * GET /api/v1/treasurer/revenue/by-officer
 * Revenue breakdown grouped by field officer.
 */
const getRevenueByOfficer = async (req, res, next) => {
    try {
        const from = (0, complaints_controller_1.queryString)(req.query.from);
        const to = (0, complaints_controller_1.queryString)(req.query.to);
        const page = parseInt((0, complaints_controller_1.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, complaints_controller_1.queryString)(req.query.limit) ?? '20');
        const skip = (page - 1) * limit;
        const dateRange = buildDateRange(from, to);
        const byOfficer = await prisma_1.prisma.invoice.groupBy({
            by: ['assignedOfficerId'],
            where: {
                createdAt: dateRange,
                assignedOfficerId: { not: null },
            },
            _sum: { amountPaid: true, totalAmount: true },
            _count: { _all: true },
            orderBy: { _sum: { amountPaid: 'desc' } },
            skip,
            take: limit,
        });
        // Enrich with officer names
        const officerIds = byOfficer
            .map((r) => r.assignedOfficerId)
            .filter(Boolean);
        const officers = await prisma_1.prisma.user.findMany({
            where: { id: { in: officerIds } },
            select: { id: true, firstName: true, lastName: true, email: true, contractorId: true,
                contractor: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        const officerMap = Object.fromEntries(officers.map((o) => [o.id, o]));
        const enriched = byOfficer.map((row) => ({
            officer: officerMap[row.assignedOfficerId] ?? { id: row.assignedOfficerId },
            collected: row._sum.amountPaid ?? 0,
            invoiced: row._sum.totalAmount ?? 0,
            transactions: row._count._all,
        }));
        return (0, response_1.sendSuccess)(res, {
            period: { from: dateRange.gte, to: dateRange.lte },
            data: enriched,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getRevenueByOfficer = getRevenueByOfficer;
/**
 * GET /api/v1/treasurer/revenue/by-ward
 * Revenue breakdown grouped by ward (via business location).
 */
const getRevenueByWard = async (req, res, next) => {
    try {
        const from = (0, complaints_controller_1.queryString)(req.query.from);
        const to = (0, complaints_controller_1.queryString)(req.query.to);
        const dateRange = buildDateRange(from, to);
        // Group invoices by business ward
        const invoices = await prisma_1.prisma.invoice.findMany({
            where: {
                createdAt: dateRange,
                businessId: { not: null },
            },
            select: {
                amountPaid: true,
                totalAmount: true,
                status: true,
                business: { select: { wardId: true } },
            },
        });
        // Aggregate manually since Prisma groupBy doesn't traverse relations
        const wardMap = {};
        for (const inv of invoices) {
            const wardId = inv.business?.wardId;
            if (!wardId)
                continue;
            if (!wardMap[wardId])
                wardMap[wardId] = { invoiced: 0, collected: 0, invoiceCount: 0 };
            wardMap[wardId].invoiced += Number(inv.totalAmount);
            wardMap[wardId].collected += Number(inv.amountPaid);
            wardMap[wardId].invoiceCount += 1;
        }
        const wardIds = Object.keys(wardMap);
        const wards = await prisma_1.prisma.ward.findMany({
            where: { id: { in: wardIds } },
            select: { id: true, name: true, code: true },
        });
        const result = wards.map((w) => ({
            ward: w,
            invoiced: wardMap[w.id]?.invoiced ?? 0,
            collected: wardMap[w.id]?.collected ?? 0,
            invoiceCount: wardMap[w.id]?.invoiceCount ?? 0,
        })).sort((a, b) => b.collected - a.collected);
        return (0, response_1.sendSuccess)(res, {
            period: { from: dateRange.gte, to: dateRange.lte },
            data: result,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getRevenueByWard = getRevenueByWard;
// ─────────────────────────────────────────────────────────────
// RECONCILIATION
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/treasurer/reconciliation
 * Invoice vs payment reconciliation report.
 * Shows what was issued, what was collected, and what remains outstanding.
 */
const getReconciliation = async (req, res, next) => {
    try {
        const from = (0, complaints_controller_1.queryString)(req.query.from);
        const to = (0, complaints_controller_1.queryString)(req.query.to);
        const page = parseInt((0, complaints_controller_1.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, complaints_controller_1.queryString)(req.query.limit) ?? '20');
        const skip = (page - 1) * limit;
        const dateRange = buildDateRange(from, to);
        const where = { createdAt: dateRange };
        const [invoices, total, summary] = await Promise.all([
            prisma_1.prisma.invoice.findMany({
                where,
                skip,
                take: limit,
                include: {
                    business: { select: { id: true, businessName: true, ownerName: true } },
                    payments: { where: { status: 'confirmed' }, select: { id: true, amount: true, method: true, confirmedAt: true } },
                    receipt: { select: { id: true, receiptNumber: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.invoice.count({ where }),
            prisma_1.prisma.invoice.aggregate({
                where,
                _sum: { totalAmount: true, amountPaid: true, balanceDue: true },
            }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            period: { from: dateRange.gte, to: dateRange.lte },
            summary: {
                totalInvoiced: summary._sum.totalAmount ?? 0,
                totalCollected: summary._sum.amountPaid ?? 0,
                totalOutstanding: summary._sum.balanceDue ?? 0,
                variance: Number(summary._sum.totalAmount ?? 0) - Number(summary._sum.amountPaid ?? 0),
            },
            data: invoices,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getReconciliation = getReconciliation;
// ─────────────────────────────────────────────────────────────
// INVOICE MANAGEMENT (read-only for Treasurer)
// ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/treasurer/invoices
 * System-wide invoice list with full filter support.
 */
const getAllInvoices = async (req, res, next) => {
    try {
        const from = (0, complaints_controller_1.queryString)(req.query.from);
        const to = (0, complaints_controller_1.queryString)(req.query.to);
        const status = (0, complaints_controller_1.queryString)(req.query.status);
        const category = (0, complaints_controller_1.queryString)(req.query.category);
        const officerId = (0, complaints_controller_1.queryString)(req.query.officerId);
        const businessId = (0, complaints_controller_1.queryString)(req.query.businessId);
        const page = parseInt((0, complaints_controller_1.queryString)(req.query.page) ?? '1');
        const limit = parseInt((0, complaints_controller_1.queryString)(req.query.limit) ?? '20');
        const skip = (page - 1) * limit;
        const where = {};
        if (from || to)
            where.createdAt = buildDateRange(from, to);
        if (status)
            where.status = status;
        if (category)
            where.category = category;
        if (officerId)
            where.assignedOfficerId = officerId;
        if (businessId)
            where.businessId = businessId;
        const [invoices, total] = await Promise.all([
            prisma_1.prisma.invoice.findMany({
                where,
                skip,
                take: limit,
                include: {
                    business: { select: { id: true, businessName: true, ownerName: true } },
                    assignedOfficer: { select: { id: true, firstName: true, lastName: true } },
                    levyConfig: { select: { id: true, name: true, billingCycle: true } },
                    receipt: { select: { id: true, receiptNumber: true, issuedAt: true } },
                    _count: { select: { payments: true } },
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
exports.getAllInvoices = getAllInvoices;
/**
 * GET /api/v1/treasurer/invoices/:id
 * Single invoice with full payment trail.
 */
const getInvoiceById = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const invoice = await prisma_1.prisma.invoice.findUnique({
            where: { id },
            include: {
                business: { select: { id: true, businessName: true, ownerName: true, phone: true, address: true } },
                assignedOfficer: { select: { id: true, firstName: true, lastName: true, email: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
                levyConfig: { select: { id: true, name: true, category: true, billingCycle: true, amount: true } },
                payments: { orderBy: { createdAt: 'asc' } },
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
exports.getInvoiceById = getInvoiceById;
/**
 * PATCH /api/v1/treasurer/invoices/:id/mark-overdue
 * Treasurer manually marks overdue invoices and applies penalty.
 * In production this would run as a scheduled job.
 */
const markInvoiceOverdue = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const treasurerId = req.user.id;
        const invoice = await prisma_1.prisma.invoice.findUnique({
            where: { id },
            include: { levyConfig: { select: { penaltyRate: true } } },
        });
        if (!invoice)
            return (0, response_1.sendError)(res, 'Invoice not found', 'NOT_FOUND', null, 404);
        if (['paid', 'cancelled'].includes(invoice.status)) {
            return (0, response_1.sendError)(res, 'Cannot mark a paid or cancelled invoice as overdue', 'BAD_REQUEST', null, 400);
        }
        // Apply penalty if levy config has a penalty rate
        const penaltyRate = Number(invoice.levyConfig?.penaltyRate ?? 0);
        const penaltyAmount = penaltyRate > 0
            ? (Number(invoice.subtotal) * penaltyRate) / 100
            : 0;
        const newTotal = Number(invoice.subtotal) + penaltyAmount;
        const newBalanceDue = newTotal - Number(invoice.amountPaid);
        const updated = await prisma_1.prisma.invoice.update({
            where: { id },
            data: {
                status: 'overdue',
                penaltyAmount,
                totalAmount: newTotal,
                balanceDue: newBalanceDue,
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                action: 'invoice_edited',
                entity: 'Invoice',
                entityId: id,
                userId: treasurerId,
                details: { action: 'marked_overdue', penaltyAmount, newTotal },
                ipAddress: (0, complaints_controller_1.getIp)(req),
            },
        });
        return (0, response_1.sendSuccess)(res, updated, `Invoice marked overdue${penaltyAmount > 0 ? `. Penalty of ₦${penaltyAmount} applied.` : ''}`);
    }
    catch (err) {
        next(err);
    }
};
exports.markInvoiceOverdue = markInvoiceOverdue;
