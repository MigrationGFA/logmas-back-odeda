// middleware/authorize.middleware.ts
import { Role } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Unauthenticated', 'UNAUTHORIZED', null, 401);
    }
    if (!roles.includes(req.user.role as Role)) {
      return sendError(res, 'You do not have permission to access this resource', 'FORBIDDEN', null, 403);
    }
    next();
  };
};