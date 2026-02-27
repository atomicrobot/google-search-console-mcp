import { describe, it, expect, beforeEach, mock } from "bun:test";
import { loadConfig, getConfig } from "@config";

const mockGetAuthUrl = mock(() => "https://accounts.google.com/o/oauth2/auth?mock=1");
const mockExchangeCode = mock(() =>
  Promise.resolve({
    email: "user@example.com",
    hd: "example.com",
    name: "Test User",
  }),
);

mock.module("@auth/google", () => ({
  getAuthUrl: mockGetAuthUrl,
  exchangeCode: mockExchangeCode,
}));

const testEnv = {
  GCP_PROJECT_ID: "test-project",
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  ALLOWED_DOMAIN: "example.com",
  SERVER_URL: "http://localhost:8080",
  JWT_SECRET: "a-very-long-secret-key-for-testing",
};

describe("oauth-routes", () => {
  beforeEach(() => {
    loadConfig(testEnv);
  });

  it("well-known endpoint returns metadata", async () => {
    const { oauthRouter } = await import("@auth/oauth-routes");
    const config = getConfig();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = (oauthRouter as any).stack.find(
      (l: { route?: { path: string } }) =>
        l.route?.path === "/.well-known/oauth-authorization-server",
    );
    expect(layer).toBeDefined();

    const req = {};
    const json = mock(() => {});
    const res = { json };

    layer.route.stack[0].handle(
      req,
      res,
      mock(() => {}),
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        issuer: config.SERVER_URL,
        authorization_endpoint: `${config.SERVER_URL}/authorize`,
        token_endpoint: `${config.SERVER_URL}/token`,
      }),
    );
  });
});
