// auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../utils/prisma';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { sendSuccess, sendError } from '../../utils/response';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return sendError(res, 'Email already registered', 'CONFLICT', null, 409);

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, firstName, lastName, role: role || 'citizen' }
    });

    const { password: _, ...userResponse } = user;
    return sendSuccess(res, userResponse, null, 201);
  } catch (err) { next(err); }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return sendError(res, 'Invalid verification credentials credentials provided', 'UNAUTHORIZED', null, 401);
    }

    const accessToken = generateAccessToken({ id: user.id, role: user.role, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id });

    return sendSuccess(res, { accessToken, refreshToken, role: user.role });
  } catch (err) { next(err); }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.id } });
    if (!user) return sendError(res, 'User record profile could not be localized', 'NOT_FOUND', null, 404);
    const { password: _, ...userResponse } = user;
    return sendSuccess(res, userResponse);
  } catch (err) { next(err); }
};