import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendError } from "../../utils/response";
import * as ServiceService from "./service.service";
import { queryString } from "../complaints/complaints.controller";

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