// import { Request, Response, NextFunction } from 'express';
// import { verifyAccessToken } from '../utils/jwt';
// import { sendError } from '../utils/response';
import { Role } from '@prisma/client';

// export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return sendError(res, 'Authorization token missing or malformed', 'UNAUTHORIZED', null, 401);
//     }

//     const token = authHeader.split(' ')[1];
//     const decoded = verifyAccessToken(token);

//     console.log('JWT_SECRET present:', !!process.env.JWT_SECRET); // ← add this
//     console.log('Token received:', token.substring(0, 20) + '...'); // ← add this
    
//     req.user = {
//       ...decoded,
//       role: decoded.role as Role
//     };
//     next();
//   } catch (error) {
//     return sendError(res, 'Invalid or expired access token', 'UNAUTHORIZED', null, 401);
//   }
// };

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/response';
import { prisma } from '../utils/prisma';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authorization token missing or malformed', 'UNAUTHORIZED', null, 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token); // returns JwtPayload

    // Fetch user from DB to get current tokenVersion
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, isActive: true },
    });

    if (!user) {
      return sendError(res, 'User not found', 'UNAUTHORIZED', null, 401);
    }

    // Check token version
    if (decoded.tokenVersion !== user.tokenVersion) {
      return sendError(res, 'Session invalidated. Please log in again.', 'UNAUTHORIZED', null, 401);
    }

    // Optional: check if account is suspended (even if token is valid)
    if (!user.isActive) {
      return sendError(res, 'Account suspended', 'SUSPENDED', null, 403);
    }

    // Attach full user info (you may want to fetch more fields)
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      wardId: decoded.wardId,
      tokenVersion: decoded.tokenVersion,
    };
    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired access token', 'UNAUTHORIZED', null, 401);
  }
};