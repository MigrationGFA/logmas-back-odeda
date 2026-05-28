// wards.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';

export const createWard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entity = await prisma.ward.create({ data: req.body });
    return sendSuccess(res, entity, null, 201);
  } catch (err) { next(err); }
};

export const getWards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const datasets = await prisma.ward.findMany({ where: { deletedAt: null } });
    return sendSuccess(res, datasets);
  } catch (err) { next(err); }
};

export const updateWard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await prisma.ward.update({ where: { id:String(req.params.id) }, data: req.body });
    return sendSuccess(res, response);
  } catch (err) { next(err); }
};

export const softDeleteWard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.ward.update({ where: { id:String(req.params.id) }, data: { deletedAt: new Date() } });
    return sendSuccess(res, { message: 'Ward systemic perimeter entity soft dropped.' });
  } catch (err) { next(err); }
};