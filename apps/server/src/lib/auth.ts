import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
// Long-lived on purpose — a short expiry silently 401s every call once it lapses,
// which looked like the register had closed itself overnight.
const JWT_EXPIRES_IN = "30d";

export interface AuthTokenPayload {
  sub: string;
  name: string;
  role: Role;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
