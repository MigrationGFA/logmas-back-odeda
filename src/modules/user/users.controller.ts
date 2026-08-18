// users.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import bcrypt from 'bcryptjs';

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hash, firstName, lastName, role }
    });
    return sendSuccess(res, user, null, 201);
  } catch (err) { next(err); }
};

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await prisma.user.findMany({ where: { isActive: true } });
    return sendSuccess(res, records);
  } catch (err) { next(err); }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!record || !record.isActive) return sendError(res, 'User system entity missing', 'NOT_FOUND', null, 404);
    return sendSuccess(res, record);
  } catch (err) { next(err); }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await prisma.user.update({ where: { id: String(req.params.id) }, data: req.body });
    return sendSuccess(res, updated);
  } catch (err) { next(err); }
};

export const softDeleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({ where: { id: String(req.params.id) }, data: { isActive: false } });
    return sendSuccess(res, { message: 'User runtime identity profile flag-deleted successfully' });
  } catch (err) { next(err); }
};