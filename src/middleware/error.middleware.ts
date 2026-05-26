import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
const env = require('../config/env');

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('🔥 Centralized Error Captured:', err.message || err);

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected operational breakdown occurred.';
  const details = env.NODE_ENV === 'development' ? err.stack : null;

  return sendError(res, message, code, details, statusCode);
};