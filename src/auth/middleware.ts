import type { Request, Response, NextFunction } from "express";
import { getConfig } from "@config";
import { addMeta } from "@lib/logger";
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
    req.log = addMeta(req.log, { email: req.user.email, domain: req.user.domain });
    req.auth = {
      token: "[redacted]",
      clientId: req.user.domain,
      scopes: [],
      extra: {
        email: req.user.email,
        requestId: req.log.metadata.requestId,
      },
    };
    req.log.debug("Authenticated request");
    next();
  } catch {
    req.log.warn("Auth failed: invalid or expired token");
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
