import { Request, Response, NextFunction } from 'express';
import { fetchAllUserCertificates, fetchCertificateByIdentifier } from './certificate.service';
import { Role } from '@prisma/client';
import { sendError, sendSuccess } from '../../utils/response';

export const getCertificates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: userId, role } = (req as any).user as { id: string; role: Role };
    const data = await fetchAllUserCertificates({ role, userId });

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getCertificateById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { id: userId, role } = (req as any).user as { id: string; role: Role };
    const data = await fetchCertificateByIdentifier(String(id), role, userId);
    if (!data) {
      sendError(res, 'Certificate record not found or unauthorized', 'NOT_FOUND', null, 404);
      return;
    }

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};
