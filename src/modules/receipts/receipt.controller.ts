import { Request, Response, NextFunction } from 'express';
import { fetchAllUserReceipts, fetchReceiptByIdentifier } from './receipt.service';
import { Role } from '@prisma/client';
import { sendError, sendSuccess } from '../../utils/response';

export const getReceipts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: userId, role } = (req as any).user as { id: string; role: Role };
    const data = await fetchAllUserReceipts({ role, userId });
    
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getReceiptById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { id: userId, role } = (req as any).user as { id: string; role: Role };

    const data = await fetchReceiptByIdentifier(String(id), role, userId);
    if (!data) {
      sendError(res, 'Receipt record not found or unauthorized', 'NOT_FOUND', null, 404);
    }

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};