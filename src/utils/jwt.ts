import jwt from 'jsonwebtoken';
import env from '../config/env';

export const generateAccessToken = (payload: { id: string; role: string; email: string }) => {
  return jwt.sign(payload as {id:string; role:string; email:string}, env.JWT_SECRET as string, { expiresIn: env.JWT_EXPIRES_IN as string | number });
};

export const generateRefreshToken = (payload: { id: string }) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, env.JWT_SECRET) as { id: string; role: string; email: string };
};