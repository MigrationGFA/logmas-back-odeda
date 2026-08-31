import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendError } from "../../utils/response";
import * as ServiceService from "./service.service";
import { queryString } from "../complaints/complaints.controller";
import { Role } from "@prisma/client";

export const listServices = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const category = queryString(req.query.category);

    const services = await ServiceService.listActiveServices(category);

    return sendSuccess(res, services);
  } catch (err) {
    next(err);
  }
};

export const getServiceByCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { code } = req.params;

    const service = await ServiceService.getActiveServiceByCode(String(code));

    if (!service) {
      return sendError(
        res,
        "Service not found",
        "NOT_FOUND",
        null,
        404,
      );
    }

    return sendSuccess(res, service);
  } catch (err) {
    next(err);
  }
};

export const createServiceController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: userId, role } = req.user!;

    // Authorization check - only super_admin and lga_admin can create services
    const allowedRoles: Role[] = ["super_admin", "lga_admin", "treasurer"];
    if (!allowedRoles.includes(role)) {
      return sendError(
        res,
        "You don't have permission to create services",
        "FORBIDDEN",
        null,
        403,
      );
    }

    // Validate required fields
    const {
      code,
      name,
      category,
      revenueHead,
      description,
      requirements,
      estimatedDays,
      certificateType,
      supportsRenewal,
      isActive,
      feeConfig,
    } = req.body;

    if (!code || !name || !category || !revenueHead || !certificateType) {
      return sendError(
        res,
        "Missing required fields: code, name, category, revenueHead, certificateType",
        "VALIDATION_ERROR",
        null,
        400,
      );
    }

    if (!feeConfig || !feeConfig.amount || !feeConfig.effectiveDate) {
      return sendError(
        res,
        "Fee configuration is required with amount and effectiveDate",
        "VALIDATION_ERROR",
        null,
        400,
      );
    }

    const result = await ServiceService.createService(
      {
        code,
        name,
        category,
        revenueHead,
        description: description || "",
        requirements: requirements || [],
        estimatedDays: estimatedDays || 3,
        certificateType,
        supportsRenewal: supportsRenewal || false,
        isActive: isActive !== undefined ? isActive : true,
        feeConfig: {
          amount: Number(feeConfig.amount),
          expiryDate: feeConfig.expiryDate ? new Date(feeConfig.expiryDate) : undefined,
        },
      },
      userId,
    );

    return sendSuccess(res, {
      message: "Service created successfully",
      data: result,
    });
  } catch (err: any) {
    if (err.message.includes("already exists")) {
      return sendError(
        res,
        err.message,
        "CONFLICT",
        null,
        409,
      );
    }
    if (err.message.includes("must be")) {
      return sendError(
        res,
        err.message,
        "VALIDATION_ERROR",
        null,
        400,
      );
    }
    next(err);
  }
};


export const updateServiceController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: userId, role } = req.user!;
    const { id } = req.params;

    // Authorization check - only super_admin and lga_admin can update services
    const allowedRoles: Role[] = ["super_admin", "lga_admin", "treasurer"];
    if (!allowedRoles.includes(role)) {
      return sendError(
        res,
        "You don't have permission to update services",
        "FORBIDDEN",
        null,
        403,
      );
    }

    const {
      code,
      name,
      category,
      revenueHead,
      description,
      requirements,
      estimatedDays,
      certificateType,
      supportsRenewal,
      isActive,
      feeConfig,
    } = req.body;

    // Prepare update data - only include fields that are provided
    const updateData: any = {};

    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (revenueHead !== undefined) updateData.revenueHead = revenueHead;
    if (description !== undefined) updateData.description = description;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (estimatedDays !== undefined) updateData.estimatedDays = estimatedDays;
    if (certificateType !== undefined) updateData.certificateType = certificateType;
    if (supportsRenewal !== undefined) updateData.supportsRenewal = supportsRenewal;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (feeConfig !== undefined) {
      updateData.feeConfig = {
        amount: feeConfig.amount !== undefined ? Number(feeConfig.amount) : undefined,
        effectiveDate: feeConfig.effectiveDate !== undefined 
          ? new Date(feeConfig.effectiveDate) 
          : undefined,
        expiryDate: feeConfig.expiryDate !== undefined 
          ? (feeConfig.expiryDate ? new Date(feeConfig.expiryDate) : null)
          : undefined,
        notes: feeConfig.notes !== undefined ? feeConfig.notes : undefined,
        status: feeConfig.status !== undefined ? feeConfig.status : undefined,
      };
    }

    const result = await ServiceService.updateService(
      String(id),
      updateData,
      userId,
    );

    return sendSuccess(res, {
      message: "Service updated successfully",
      data: result,
    });
  } catch (err: any) {
    if (err.message.includes("not found")) {
      return sendError(
        res,
        err.message,
        "NOT_FOUND",
        null,
        404,
      );
    }
    if (err.message.includes("already exists")) {
      return sendError(
        res,
        err.message,
        "CONFLICT",
        null,
        409,
      );
    }
    if (err.message.includes("must be") || err.message.includes("required")) {
      return sendError(
        res,
        err.message,
        "VALIDATION_ERROR",
        null,
        400,
      );
    }
    next(err);
  }
};