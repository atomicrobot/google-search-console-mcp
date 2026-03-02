import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { Request, Response, NextFunction } from "express";
import { authMiddleware } from "@auth/middleware";
import { loadConfig } from "@config";
import { mintToken } from "@auth/jwt";
import { createRequestLogger } from "@lib/logger";

const testEnv = {
  GCP_PROJECT_ID: "test-project",
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  ALLOWED_DOMAIN: "example.com",
  SERVER_URL: "http://localhost:8080",
  JWT_SECRET: "a-very-long-secret-key-for-testing",
};

function mockReqRes(authHeader?: string) {
  const req = {
    headers: { authorization: authHeader },
    path: "/mcp",
    log: createRequestLogger({ requestId: "test-request-id" }),
  } as unknown as Request;
  const res = {
    status: mock(() => res),
    json: mock(() => res),
    setHeader: mock(() => res),
  } as unknown as Response;
  const next = mock(() => {}) as unknown as NextFunction;
  return { req, res, next };
}

describe("authMiddleware", () => {
  beforeEach(() => {
    loadConfig(testEnv);
  });

  it("passes with valid token", () => {
    const token = mintToken("user@example.com", "example.com");
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.email).toBe("user@example.com");
  });

  it("accumulates email onto req.log metadata", () => {
    const token = mintToken("user@example.com", "example.com");
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    authMiddleware(req, res, next);
    expect(req.log?.metadata.email).toBe("user@example.com");
    expect(req.log?.metadata.domain).toBe("example.com");
    expect(req.log?.metadata.requestId).toBe("test-request-id");
  });

  it("sets req.auth with extra metadata for MCP transport", () => {
    const token = mintToken("user@example.com", "example.com");
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    authMiddleware(req, res, next);
    expect(req.auth).toBeDefined();
    expect(req.auth?.token).toBe("[redacted]");
    expect(req.auth?.clientId).toBe("example.com");
    expect(req.auth?.scopes).toEqual([]);
    expect(req.auth?.extra?.email).toBe("user@example.com");
    expect(req.auth?.extra?.requestId).toBe("test-request-id");
  });

  it("rejects missing auth header", () => {
    const { req, res, next } = mockReqRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects invalid token", () => {
    const { req, res, next } = mockReqRes("Bearer invalid-token");
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
