import { Response } from 'express';

export const sendSuccess = (res: Response, data: any, meta: any = null, statusCode = 200) => {
  return res.status(statusCode).json({
    ...data,
    meta,
    error: null
  });
};

export const sendError = (res: Response, message: string, code = 'INTERNAL_SERVER_ERROR', details: any = null, statusCode = 500) => {
  return res.status(statusCode).json({
    data: null,
    meta: null,
    error: {
      code,
      message,
      details
    }
  });
};