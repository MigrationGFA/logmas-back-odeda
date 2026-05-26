// complaints.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess } from '../../utils/response';

export const createComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.complaint.create({ data: req.body });
    return sendSuccess(res, data, null, 201);
  } catch (err) { next(err); }
};

export const listComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await prisma.complaint.findMany({ include: { ward: true, assignedTo: true } });
    return sendSuccess(res, list);
  } catch (err) { next(err); }
};

export const assignComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignedToId } = req.body;
    const task = await prisma.complaint.update({
      where: { id: req.params.id },
      data: { assignedToId, status: 'assigned' }
    });
    return sendSuccess(res, task);
  } catch (err) { next(err); }
};

export const resolveComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const log = await prisma.complaint.update({
      where: { id: req.params.id },
      data: { status: 'resolved' }
    });
    return sendSuccess(res, log);
  } catch (err) { next(err); }
};