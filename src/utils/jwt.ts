
// src/utils/jwt.ts (example)
import jwt from "jsonwebtoken";
import env from "../config/env";
import { Role } from "@prisma/client";

export interface JwtPayload {
  id: string;
  role: Role;
  email: string;
  wardId?: string | null;
  tokenVersion: number; // NEW
}

export function generateAccessToken(user: {
  id: string;
  role: Role;
  email: string;
  wardId?: string | null;
  tokenVersion: number; // NEW
}): string {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
      wardId: user.wardId || null,
      tokenVersion: user.tokenVersion,
    },
    env.JWT_SECRET as string,
    { expiresIn: env.JWT_EXPIRES_IN as any },
  );
}

// refresh token does NOT need tokenVersion (only used to get new access token)
export function generateRefreshToken(payload: { id: string }) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET as string, { expiresIn: "7d" });
}

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, env.JWT_SECRET as string) as {
    id: string;
    role: Role;
    email: string;
    wardId?: string | null; // Extract safely during verification
    tokenVersion: number;
  };
};
