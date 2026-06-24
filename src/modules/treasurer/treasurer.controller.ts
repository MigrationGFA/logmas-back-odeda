// src/modules/treasurer/treasurer.controller.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../../utils/prisma";
import { sendSuccess, sendError } from "../../utils/response";
import { InvoiceStatus, RevenueCategory } from "@prisma/client";
import { getIp, queryString } from "../complaints/complaints.controller";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Builds a Prisma date range filter from query params.
 * Defaults: from = start of current month, to = now
 */
const buildDateRange = (from?: string, to?: string) => {
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
export const createLevyConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const treasurerId = req.user!.id;
    const {
      name,
      categoryId,
      description,
      amount,
      mode,
      billingCycle,
      penaltyRate,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    // Warn if an active config already exists for this category
    // We don't block it — Treasurer may want to schedule a future config
    const existing = await prisma.levyConfig.findFirst({
      where: { categoryId, isActive: true },
      select: { id: true, name: true, amount: true },
    });

    const config = await prisma.levyConfig.create({
      data: {
        name,
        categoryId,
        mode,
        description,
        amount,
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

    await prisma.auditLog.create({
      data: {
        action: "pricing_updated",
        entity: "LevyConfig",
        entityId: config.id,
        userId: treasurerId,
        details: {  amount, billingCycle, name },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(
      res,
      {
        config,
        ...(existing && {
          warning: `An active config "${existing.name}" (₦${existing.amount}) already exists for this category. Consider deactivating it.`,
          existingConfigId: existing.id,
        }),
      },
      "Levy configuration created",
      201,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/treasurer/levy-configs
 * List all levy configs with optional filters.
 */
export const listLevyConfigs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // const category = queryString(req.query.category) as RevenueCategory | undefined;
    // const isActive = req.query.isActive !== undefined
    //   ? req.query.isActive === 'true'
    //   : undefined;
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "20");
    const skip = (page - 1) * limit;

    const where: any = {
      // ...(category   !== undefined && { category }),
      // ...(isActive   !== undefined && { isActive }),
    };

    const [configs, total] = await Promise.all([
      prisma.levyConfig.findMany({
        // where,
        skip,
        take: limit,
        include: {
          configuredBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          category:true,
          _count: { select: { invoices: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.levyConfig.count({ where }),
    ]);

    return sendSuccess(res, {
      data: configs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/treasurer/levy-configs/:id
 * Get a single levy config with invoice count.
 */
export const getLevyConfigById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const config = await prisma.levyConfig.findUnique({
      where: { id },
      include: {
        configuredBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { invoices: true } },
      },
    });

    if (!config)
      return sendError(
        res,
        "Levy configuration not found",
        "NOT_FOUND",
        null,
        404,
      );

    return sendSuccess(res, config);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/treasurer/levy-configs/:id
 * Update a levy config — amount, cycle, penalty rate, etc.
 */
export const updateLevyConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const treasurerId = req.user!.id;

    const config = await prisma.levyConfig.findUnique({ where: { id } });
    if (!config)
      return sendError(
        res,
        "Levy configuration not found",
        "NOT_FOUND",
        null,
        404,
      );

    const {
      name,
      description,
      amount,
      billingCycle,
      penaltyRate,
      effectiveTo,
    } = req.body;

    const updated = await prisma.levyConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(amount !== undefined && { amount }),
        ...(billingCycle !== undefined && { billingCycle }),
        ...(penaltyRate !== undefined && { penaltyRate }),
        ...(effectiveTo !== undefined && {
          effectiveTo: new Date(effectiveTo),
        }),
      },
      include: {
        configuredBy: { select: { id: true, firstName: true, lastName: true } },
        category: true
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "pricing_updated",
        entity: "LevyConfig",
        entityId: id,
        userId: treasurerId,
        details: {
          before: { amount: config.amount, billingCycle: config.billingCycle },
          after: { amount: updated.amount, billingCycle: updated.billingCycle },
        },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, updated, "Levy configuration updated");
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/treasurer/levy-configs/:id/toggle
 * Activate or deactivate a levy config.
 */
export const toggleLevyConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const treasurerId = req.user!.id;

    const config = await prisma.levyConfig.findUnique({ where: { id } });
    if (!config)
      return sendError(
        res,
        "Levy configuration not found",
        "NOT_FOUND",
        null,
        404,
      );

    const updated = await prisma.levyConfig.update({
      where: { id },
      data: { isActive: !config.isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: "pricing_updated",
        entity: "LevyConfig",
        entityId: id,
        userId: treasurerId,
        details: { action: updated.isActive ? "activated" : "deactivated" },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(
      res,
      updated,
      `Levy configuration ${updated.isActive ? "activated" : "deactivated"}`,
    );
  } catch (err) {
    next(err);
  }
};

export const listPermitConfigs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // const category = req.query.category as RevenueCategory | undefined;
    // const isActive =
    //   req.query.isActive !== undefined
    //     ? req.query.isActive === "true"
    //     : undefined;
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    // if (category) whereClause.category = category;
    // if (isActive !== undefined) whereClause.isActive = isActive;

    const [configs, total] = await Promise.all([
      prisma.permitConfig.findMany({
        where: whereClause,
        include: {
          _count: { select: { permits: true } },
          category:true
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.permitConfig.count({ where: whereClause }),
    ]);

    return res.status(200).json({
      success: true,
      data: configs,
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

export const createPermitConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, code, categoryId, baseAmount } = req.body;

    // Check for unique code constraints to prevent raw runtime errors
    const existingConfig = await prisma.permitConfig.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existingConfig) {
      return sendError(
        res,
        `Configuration variant code "${code}" already exists`,
        "CONFLICT",
        null,
        409,
      );
    }

    const newConfig = await prisma.permitConfig.create({
      data: {
        name,
        code: code.toUpperCase(),
        categoryId,
        baseAmount: Number(baseAmount),
      },
    });

    return sendSuccess(res, newConfig, 201);
  } catch (err) {
    next(err);
  }
};

export const updatePermitConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { name, baseAmount, isActive } = req.body;

    const config = await prisma.permitConfig.findUnique({
      where: { id: String(id) },
    });
    if (!config) {
      return sendError(
        res,
        "Permit configuration not found",
        "NOT_FOUND",
        null,
        404,
      );
    }

    if(config.name === name){
      return sendError(res,"Conflict with name","CONFLICT",401)
    }

    const updatedConfig = await prisma.permitConfig.update({
      where: { id: String(id) },
      data: {
        ...(name && { name }),
        ...(baseAmount !== undefined && { baseAmount: Number(baseAmount) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return sendSuccess(res, updatedConfig);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// REVENUE ANALYTICS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/treasurer/revenue
 * System-wide revenue overview.
 * Supports date range filtering. Defaults to current month.
 */
export const getRevenueOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    const dateRange = buildDateRange(from, to);

    const [totalSummary, byCategory, byStatus, byPaymentMethod, dailyTrendRaw] =
      await Promise.all([
        // 1. Overall totals
        prisma.invoice.aggregate({
          where: { createdAt: dateRange },
          _sum: { totalAmount: true, amountPaid: true, balanceDue: true },
          _count: { _all: true },
        }),

        // 2. Revenue by category string ID link
        prisma.invoice.groupBy({
          by: ["categoryId"], // Updated to track relational table graduation
          where: { createdAt: dateRange },
          _sum: { totalAmount: true, amountPaid: true },
          _count: { _all: true },
        }),

        // 3. Invoice count by status
        prisma.invoice.groupBy({
          by: ["status"],
          where: { createdAt: dateRange },
          _sum: { totalAmount: true },
          _count: { _all: true },
        }),

        // 4. Payment method breakdown (confirmed payments only)
        prisma.payment.groupBy({
          by: ["method"],
          where: { status: "confirmed", createdAt: dateRange },
          _sum: { amount: true },
          _count: { _all: true },
        }),

        // 5. Daily collection trend (FIXED: Dropped database orderBy to avoid type circularity)
        prisma.payment.groupBy({
          by: ["createdAt"],
          where: { status: "confirmed", createdAt: dateRange },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);

    // Format metrics
    const collectionRate = totalSummary._sum.totalAmount
      ? (
          (Number(totalSummary._sum.amountPaid) /
            Number(totalSummary._sum.totalAmount)) *
          100
        ).toFixed(2)
      : "0.00";

    // FIX: Safely sort the dates using standard JavaScript on the runtime stack
    const sortedDailyTrend = dailyTrendRaw
      .map((d) => ({
        date: d.createdAt,
        collected: d._sum.amount ?? 0,
        transactions: d._count._all,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },
      summary: {
        totalInvoiced: totalSummary._sum.totalAmount ?? 0,
        totalCollected: totalSummary._sum.amountPaid ?? 0,
        totalOutstanding: totalSummary._sum.balanceDue ?? 0,
        totalInvoices: totalSummary._count._all,
        collectionRate: `${collectionRate}%`,
      },
      byCategory: byCategory.map((c) => ({
        category: c.categoryId,
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
      dailyTrend: sortedDailyTrend,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/treasurer/revenue/by-officer
 * Revenue breakdown grouped by field officer.
 */
export const getRevenueByOfficer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "20");
    const skip = (page - 1) * limit;
    const dateRange = buildDateRange(from, to);

    const byOfficer = await prisma.invoice.groupBy({
      by: ["assignedOfficerId"],
      where: {
        createdAt: dateRange,
        assignedOfficerId: { not: null },
      },
      _sum: { amountPaid: true, totalAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { amountPaid: "desc" } },
      skip,
      take: limit,
    });

    // Enrich with officer names
    const officerIds = byOfficer
      .map((r) => r.assignedOfficerId)
      .filter(Boolean) as string[];

    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        contractorId: true,
        contractor: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const officerMap = Object.fromEntries(officers.map((o) => [o.id, o]));

    const enriched = byOfficer.map((row) => ({
      officer: officerMap[row.assignedOfficerId!] ?? {
        id: row.assignedOfficerId,
      },
      collected: row._sum.amountPaid ?? 0,
      invoiced: row._sum.totalAmount ?? 0,
      transactions: row._count._all,
    }));

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
};




export const getFieldOfficersList = async (req: Request, res: Response) => {
  try {
    const { id: userId, role } = req.user!; // Extracted from auth middleware

    // 1. Scope query filter variables dynamically based on hierarchy roles
    const whereClause: any = {
      deletedAt: null, // Exclude soft-deleted users globally
    };

    if (role === "contractor") {
      // Contractors see all agents & field officers down their operational tree
      whereClause.contractorId = userId;
      whereClause.role = { in: ["agent", "field_officer"] };
    } else if (role === "agent") {
      // Agents only see the specific field officers assigned under them
      whereClause.agentId = userId;
      whereClause.role = "field_officer";
    } else {
      // Treasurer / Admin / Superadmin roles see all transactional field workers
      whereClause.role = { in: ["agent", "field_officer"] };
    }

    // 2. Query database using dynamic scoping boundaries
    const officers = await prisma.user.findMany({
      where: whereClause,
      include: {
        ward: true,
        createdBy: {
          select: { firstName: true, lastName: true },
        },
        // Pull invoices they are assigned to execute collection duties on
        invoicesAssignedTo: {
          include: {
            category: true,
            payments: {
              where: { status: "confirmed" },
              select: { amount: true },
            },
          },
        },
        // Pull invoices they personally generated out in the field
        invoicesCreated: {
          include: {
            category: true,
            payments: {
              where: { status: "confirmed" },
              select: { amount: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

  // 3. Map values safely to match frontend UI components exactly
  const mappedOfficers = officers.map((o) => {
    // A collection agent or officer might be collecting via both assignments or creations.
    // We safe-guard calculation arrays here:
    const assignedPaymentsTotal = o.invoicesAssignedTo.reduce((sum, inv) => {
      return sum + inv.payments.reduce((pSum, p) => pSum + Number(p.amount), 0);
    }, 0);

    const createdPaymentsTotal = o.invoicesCreated.reduce((sum, inv) => {
      return sum + inv.payments.reduce((pSum, p) => pSum + Number(p.amount), 0);
    }, 0);

    // Dynamic collection calculation fallback
    const totalCollected = Math.max(assignedPaymentsTotal, createdPaymentsTotal);

    // Merge unique revenue item category names from both paths
    const assignedCategories = o.invoicesAssignedTo.map((inv) => inv.category?.name);
    const createdCategories = o.invoicesCreated.map((inv) => inv.category?.name);
    const levies = [...new Set([...assignedCategories, ...createdCategories])].filter(Boolean);

    // Guard user status states
    let status: "active" | "suspended" | "deactivated" = "active";
    if (o.deletedAt) status = "deactivated";
    else if (!o.isActive || o.suspendedAt) status = "suspended";

    return {
      id: o.id,
      name: `${o.firstName} ${o.lastName}`,
      email: o.email,
      phone: o.phone ?? "N/A",
      role: o.role, // "agent" or "field_officer"
      ward: o.ward?.name || "Unassigned",
      levies: levies.length > 0 ? levies : ["General Collection"],
      invoicesIssued: Math.max(o.invoicesAssignedTo.length, o.invoicesCreated.length),
      totalCollected,
      status,
      createdBy: o.createdBy
        ? `${o.createdBy.firstName} ${o.createdBy.lastName}`
        : "System",
      contractorId: o.contractorId,
      agentId: o.agentId,
    };
  });

    // 4. Group metrics matching the frontend dashboard card grid layout
    const stats = {
      totalOfficers: mappedOfficers.length,
      active: mappedOfficers.filter((o) => o.status === "active").length,
      suspended: mappedOfficers.filter((o) => o.status === "suspended").length,
      totalCollected: mappedOfficers.reduce((sum, o) => sum + o.totalCollected, 0),
    };

    return res.status(200).json({
      success: true,
      data: {
        stats,
        officers: mappedOfficers,
      },
    });
  } catch (error) {
    console.error("Error fetching scoped field personnel list:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/v1/treasurer/revenue/by-ward
 * Revenue breakdown grouped by ward (via business location).
 */
export const getRevenueByWard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    const dateRange = buildDateRange(from, to);

    // Group invoices by business ward
    const invoices = await prisma.invoice.findMany({
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
    const wardMap: Record<
      string,
      { invoiced: number; collected: number; invoiceCount: number }
    > = {};
    for (const inv of invoices) {
      const wardId = inv.business?.wardId;
      if (!wardId) continue;
      if (!wardMap[wardId])
        wardMap[wardId] = { invoiced: 0, collected: 0, invoiceCount: 0 };
      wardMap[wardId].invoiced += Number(inv.totalAmount);
      wardMap[wardId].collected += Number(inv.amountPaid);
      wardMap[wardId].invoiceCount += 1;
    }

    const wardIds = Object.keys(wardMap);
    const wards = await prisma.ward.findMany({
      where: { id: { in: wardIds } },
      select: { id: true, name: true, code: true },
    });

    const result = wards
      .map((w) => ({
        ward: w,
        invoiced: wardMap[w.id]?.invoiced ?? 0,
        collected: wardMap[w.id]?.collected ?? 0,
        invoiceCount: wardMap[w.id]?.invoiceCount ?? 0,
      }))
      .sort((a, b) => b.collected - a.collected);

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// RECONCILIATION
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/treasurer/reconciliation
 * Invoice vs payment reconciliation report.
 * Shows what was issued, what was collected, and what remains outstanding.
 */
export const getReconciliation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "20");
    const skip = (page - 1) * limit;
    const dateRange = buildDateRange(from, to);

    const where = { createdAt: dateRange };

    const [invoices, total, summary] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          business: {
            select: { id: true, businessName: true, ownerName: true },
          },
          payments: {
            where: { status: "confirmed" },
            select: { id: true, amount: true, method: true, confirmedAt: true },
          },
          receipt: { select: { id: true, receiptNumber: true } },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.invoice.count({ where }),

      prisma.invoice.aggregate({
        where,
        _sum: { totalAmount: true, amountPaid: true, balanceDue: true },
      }),
    ]);

    return sendSuccess(res, {
      period: { from: dateRange.gte, to: dateRange.lte },
      summary: {
        totalInvoiced: summary._sum.totalAmount ?? 0,
        totalCollected: summary._sum.amountPaid ?? 0,
        totalOutstanding: summary._sum.balanceDue ?? 0,
        variance:
          Number(summary._sum.totalAmount ?? 0) -
          Number(summary._sum.amountPaid ?? 0),
      },
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// INVOICE MANAGEMENT (read-only for Treasurer)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/treasurer/invoices
 * System-wide invoice list with full filter support.
 */
export const getAllInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    const status = queryString(req.query.status) as InvoiceStatus | undefined;
    // const category = queryString(req.query.category) as
    //   | RevenueCategory
    //   | undefined;
    const officerId = queryString(req.query.officerId);
    const businessId = queryString(req.query.businessId);
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "20");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (from || to) where.createdAt = buildDateRange(from, to);
    if (status) where.status = status;
    // if (category) where.category = category;
    if (officerId) where.assignedOfficerId = officerId;
    if (businessId) where.businessId = businessId;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          business: {
            select: { id: true, businessName: true, ownerName: true },
          },
          assignedOfficer: {
            select: { id: true, firstName: true, lastName: true },
          },
          levyConfig: { select: { id: true, name: true, billingCycle: true } },
          receipt: {
            select: { id: true, receiptNumber: true, issuedAt: true },
          },
          _count: { select: { payments: true } },
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
 * GET /api/v1/treasurer/invoices/:id
 * Single invoice with full payment trail.
 */
export const getInvoiceById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        business: {
          select: {
            id: true,
            businessName: true,
            ownerName: true,
            phone: true,
            address: true,
          },
        },
        assignedOfficer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        levyConfig: {
          select: {
            id: true,
            name: true,
            category: true,
            billingCycle: true,
            amount: true,
          },
        },
        payments: { orderBy: { createdAt: "asc" } },
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

/**
 * PATCH /api/v1/treasurer/invoices/:id/mark-overdue
 * Treasurer manually marks overdue invoices and applies penalty.
 * In production this would run as a scheduled job.
 */
export const markInvoiceOverdue = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const treasurerId = req.user!.id;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { levyConfig: { select: { penaltyRate: true } } },
    });

    if (!invoice)
      return sendError(res, "Invoice not found", "NOT_FOUND", null, 404);

    if (["paid", "cancelled"].includes(invoice.status)) {
      return sendError(
        res,
        "Cannot mark a paid or cancelled invoice as overdue",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // Apply penalty if levy config has a penalty rate
    const penaltyRate = Number(invoice.levyConfig?.penaltyRate ?? 0);
    const penaltyAmount =
      penaltyRate > 0 ? (Number(invoice.subtotal) * penaltyRate) / 100 : 0;

    const newTotal = Number(invoice.subtotal) + penaltyAmount;
    const newBalanceDue = newTotal - Number(invoice.amountPaid);

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: "overdue",
        penaltyAmount,
        totalAmount: newTotal,
        balanceDue: newBalanceDue,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "invoice_edited",
        entity: "Invoice",
        entityId: id,
        userId: treasurerId,
        details: { action: "marked_overdue", penaltyAmount, newTotal },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(
      res,
      updated,
      `Invoice marked overdue${penaltyAmount > 0 ? `. Penalty of ₦${penaltyAmount} applied.` : ""}`,
    );
  } catch (err) {
    next(err);
  }
};
