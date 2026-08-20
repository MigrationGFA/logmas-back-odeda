// auth.validation.ts
import { z } from 'zod';
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  // role: z.enum(['business_owner', 'citizen']).optional()
  role: z.enum(['citizen',"business_owner"]).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const googleAuthSchema = z.object({
  token: z.string().min(1, 'Google ID token or credential string is required')
});