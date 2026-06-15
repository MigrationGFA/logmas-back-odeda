import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/response';
import { Role } from '@prisma/client';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authorization token missing or malformed', 'UNAUTHORIZED', null, 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    console.log('JWT_SECRET present:', !!process.env.JWT_SECRET); // ← add this
    console.log('Token received:', token.substring(0, 20) + '...'); // ← add this
    
    req.user = {
      ...decoded,
      role: decoded.role as Role
    };
    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired access token', 'UNAUTHORIZED', null, 401);
  }
};