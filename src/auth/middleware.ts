import type { Request, Response, NextFunction } from "express";
import { getConfig } from "@config";
import { logger } from "@lib/logger";
import { verifyToken } from "@auth/jwt";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const config = getConfig();
    res.setHeader(
      "WWW-Authenticate",
      `Bearer resource_metadata="${config.SERVER_URL}/.well-known/oauth-protected-resource"`,
    );
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    logger.debug("Authenticated request", { email: req.user.email, path: req.path });
    next();
  } catch {
    logger.warn("Auth failed: invalid or expired token", { path: req.path });
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
