import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError } from '../utils/response';

export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return sendError(res, 'Data validation validation processing failed', 'VALIDATION_ERROR', result.error.format(), 400);
    }
    req.body = result.data;
    next();
  };
};