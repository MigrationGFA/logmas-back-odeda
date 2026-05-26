import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { sendError } from '../utils/response';

export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Authentication required to access role controls', 'UNAUTHORIZED', null, 401);
    }

    if (!roles.includes(req.user.role as Role)) {
      return sendError(res, 'Forbidden: Insufficient privileges assigned to your account profile', 'FORBIDDEN', null, 403);
    }

    next();
  };
};