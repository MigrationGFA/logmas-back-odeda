// env.ts
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3004'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('1d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration variables:', parsedEnv.error.format());
  process.exit(1);
}

export default parsedEnv.data;