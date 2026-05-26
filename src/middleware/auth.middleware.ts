import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/response';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authorization token missing or malformed', 'UNAUTHORIZED', null, 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    req.user = decoded;
    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired access token', 'UNAUTHORIZED', null, 401);
  }
};