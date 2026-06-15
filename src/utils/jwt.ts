import jwt, { SignOptions } from 'jsonwebtoken';
import env from '../config/env';

export const generateAccessToken = (payload: { id: string; role: string; email: string; wardId?: string | null }) => {
  return jwt.sign(
    payload, 
    env.JWT_SECRET as string, 
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, env.JWT_SECRET as string) as { 
    id: string; 
    role: string; 
    email: string; 
    wardId?: string | null; // Extract safely during verification
  };
};

export const generateRefreshToken = (payload: { id: string }) => {
  return jwt.sign(
    payload, 
    env.JWT_REFRESH_SECRET as string, 
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );
};
