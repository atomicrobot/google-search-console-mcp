import { Router, type Router as RouterType } from "express";
import crypto from "node:crypto";
import { getConfig } from "@config";
import { logger } from "@lib/logger";
import { getAuthUrl, exchangeCode } from "@auth/google";
import { mintToken } from "@auth/jwt";

const router: RouterType = Router();

// In-memory store for pending auth codes (authorization_code grant)
const pendingCodes = new Map<string, { token: string; expiresAt: number }>();

router.get("/.well-known/oauth-protected-resource", (_req, res) => {
  const config = getConfig();
  res.json({
    resource: config.SERVER_URL,
    authorization_servers: [config.SERVER_URL],
    bearer_methods_supported: ["header"],
  });
});

router.get("/.well-known/oauth-authorization-server", (_req, res) => {
  const config = getConfig();
  res.json({
    issuer: config.SERVER_URL,
    authorization_endpoint: `${config.SERVER_URL}/authorize`,
    token_endpoint: `${config.SERVER_URL}/token`,
    registration_endpoint: `${config.SERVER_URL}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
  });
});

// Dynamic Client Registration (RFC 7591) — required by MCP spec
router.post("/register", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const clientId = crypto.randomUUID();
  logger.info("Dynamic client registered", { clientId, clientName: body.client_name });
  res.status(201).json({
    client_id: clientId,
    client_name: body.client_name ?? null,
    redirect_uris: (body.redirect_uris as string[]) ?? [],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
});

router.get("/authorize", (req, res) => {
  const clientRedirectUri = (req.query.redirect_uri as string) || "";
  const clientState = (req.query.state as string) || "";

  const state = Buffer.from(
    JSON.stringify({ redirect_uri: clientRedirectUri, client_state: clientState }),
  ).toString("base64url");

  const googleUrl = getAuthUrl(state);
  res.redirect(googleUrl);
});

router.get("/oauth/callback", async (req, res) => {
  try {
    const code = req.query.code as string;
    const stateParam = req.query.state as string;

    if (!code || !stateParam) {
      res.status(400).json({ error: "Missing code or state" });
      return;
    }

    const state = JSON.parse(Buffer.from(stateParam, "base64url").toString()) as {
      redirect_uri: string;
      client_state: string;
    };

    const user = await exchangeCode(code);
    const config = getConfig();

    if (user.hd !== config.ALLOWED_DOMAIN) {
      logger.warn("Domain mismatch on OAuth callback", { email: user.email, hd: user.hd });
      res.status(403).json({
        error: `Access restricted to ${config.ALLOWED_DOMAIN} domain`,
      });
      return;
    }

    logger.info("User authenticated", { email: user.email, domain: user.hd });
    const jwt = mintToken(user.email, user.hd);

    // Generate an authorization code to return to the MCP client
    const authCode = crypto.randomBytes(32).toString("hex");
    pendingCodes.set(authCode, { token: jwt, expiresAt: Date.now() + 300_000 }); // 5 min TTL

    const redirectUrl = new URL(state.redirect_uri);
    redirectUrl.searchParams.set("code", authCode);
    if (state.client_state) {
      redirectUrl.searchParams.set("state", state.client_state);
    }

    res.redirect(redirectUrl.toString());
  } catch (err) {
    logger.error("OAuth callback error", { error: err });
    res.status(500).json({ error: "Authentication failed" });
  }
});

router.post("/token", (req, res) => {
  const { grant_type, code } = req.body as { grant_type?: string; code?: string };

  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  if (!code) {
    res.status(400).json({ error: "invalid_request", error_description: "Missing code" });
    return;
  }

  const pending = pendingCodes.get(code);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingCodes.delete(code!);
    res.status(400).json({ error: "invalid_grant" });
    return;
  }

  pendingCodes.delete(code);
  res.json({
    access_token: pending.token,
    token_type: "Bearer",
    expires_in: getConfig().TOKEN_TTL_SECONDS,
  });
});

export { router as oauthRouter };
