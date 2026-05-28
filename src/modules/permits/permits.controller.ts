// permits.controller.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';

export const createPermitApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const { title, description } = req.body;
    const permitNumber = `LOGMAS-PMT-${crypto.randomInt(100000, 999999)}`;
    const verificationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const qrTokenToken = crypto.randomUUID();

    // const entry = await prisma.permit.create({
    //   data: {
    //     // title,
    //     // description,
    //     permitNumber,
    //     verificationCode,
    //     qrToken:qrTokenToken,
    //     status: 'pending_payment',
    //     // userId: req.user!.id
    //   }
    // });
    // return sendSuccess(res, entry, null, 201);
    return true
  } catch (err) { next(err); }
};

export const issuePermit = async (req: Request, res: Response, next: NextFunction) => {
  try {
 let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const entry = await prisma.permit.update({
      where: { id},
      data: { status: 'issued' }
    });
    return sendSuccess(res, entry);
  } catch (err) { next(err); }
};

export const getPermits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await prisma.permit.findMany({ include: { issuedBy: true,business:true,invoice:true } });
    return sendSuccess(res, list);
  } catch (err) { next(err); }
};

export const verifyPermitByToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // const token = req.params.token;
     const token = Array.isArray(req.params.token) 
      ? req.params.token[0] 
      : req.params.token;
    const entry = await prisma.permit.findFirst({
      where: { OR: [{ verificationCode: token }, { qrToken: token }] }
    });
    if (!entry) return sendError(res, 'No registered verification system match for token sequence', 'NOT_FOUND', null, 404);
    return sendSuccess(res, entry);
  } catch (err) { next(err); }
};