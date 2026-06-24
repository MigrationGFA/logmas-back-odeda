import { Request, Response, NextFunction } from "express";
import { sendError, sendSuccess } from "../../utils/response";
import { prisma } from "../../utils/prisma";

// 1. Unpaginated complete listing (frontend component state loading)
export const listCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Extract the optional type from query parameters
    const { type = "LEVY" } = req.query;

    // 2. Build a dynamic where clause
    const where: any = {};
    if (type) {
      // Validates uppercase strings to match your Prisma model enum definition safely
      where.type = String(type).toUpperCase();
    }

    // 3. Fetch filtered data from Prisma
    const categories = await prisma.revenueCategory.findMany({
      where, // Injected query filter
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { levyConfigs: true, permitConfigs: true },
        },
        levyConfigs: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            amount: true,
            billingCycle: true,
            isActive: true,
            // mode: true,
          },
        },
        permitConfigs: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            baseAmount:true,
            isActive:true
          },
        },
      },
    });

    return sendSuccess(res, { data: categories });
  } catch (err) {
    next(err);
  }
};

// 2. Proposing a completely new item category
export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, description } = req.body;

    // Auto-generate clean slug variant: "Market Levy" -> "market_levy"
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_+|_+$)/g, "");

    const existing = await prisma.revenueCategory.findFirst({
      where: { OR: [{ name }, { slug }] },
    });

    if (existing) {
      return sendError(
        res,
        "A category record matching this name or identifier already exists.",
        "CONFLICT",
        null,
        409,
      );
    }

    const newCategory = await prisma.revenueCategory.create({
      data: { name, slug, description },
    });

    return sendSuccess(res, newCategory, 201);
  } catch (err) {
    next(err);
  }
};

// 3. Modifying an existing category entity
export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const target = await prisma.revenueCategory.findUnique({
      where: { id: String(id) },
    });
    if (!target) {
      return sendError(
        res,
        "Target Revenue Category record not found.",
        "NOT_FOUND",
        null,
        404,
      );
    }

    let slug;
    if (name) {
      slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/(^_+|_+$)/g, "");
    }

    const updated = await prisma.revenueCategory.update({
      where: { id: String(id) },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
};

// 4. Deleting a record from the table
export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const target = await prisma.revenueCategory.findUnique({
      where: { id: String(id) },
      include: {
        _count: {
          select: { levyConfigs: true, permitConfigs: true, invoices: true },
        },
      },
    });

    if (!target) {
      return sendError(
        res,
        "Target Category not found.",
        "NOT_FOUND",
        null,
        404,
      );
    }

    // Check if records are actively utilizing this category row link
    const usageCount =
      target._count.levyConfigs +
      target._count.permitConfigs +
      target._count.invoices;
    if (usageCount > 0) {
      return sendError(
        res,
        `Cannot drop record. This category has active dependent relational ties across ${usageCount} systems. Consider deactivating instead.`,
        "BAD_REQUEST",
        null,
        400,
      );
    }

    await prisma.revenueCategory.delete({ where: { id: String(id) } });
    return sendSuccess(res, {
      message: "Revenue matrix category purged successfully.",
    });
  } catch (err) {
    next(err);
  }
};
