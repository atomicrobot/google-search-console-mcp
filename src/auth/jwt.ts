import jwt from "jsonwebtoken";
import { getConfig } from "@config";

export interface TokenPayload {
  email: string;
  domain: string;
}

export function mintToken(email: string, domain: string): string {
  const config = getConfig();
  return jwt.sign({ email, domain } satisfies TokenPayload, config.JWT_SECRET, {
    expiresIn: config.TOKEN_TTL_SECONDS,
  });
}

export function verifyToken(token: string): TokenPayload {
  const config = getConfig();
  const payload = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload & TokenPayload;
  if (!payload.email || !payload.domain) {
    throw new Error("Invalid token payload");
  }
  return { email: payload.email, domain: payload.domain };
}
