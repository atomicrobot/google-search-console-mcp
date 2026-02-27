import { describe, it, expect, beforeEach } from "bun:test";
import { mintToken, verifyToken } from "@auth/jwt";
import { loadConfig } from "@config";

const testEnv = {
  GCP_PROJECT_ID: "test-project",
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  ALLOWED_DOMAIN: "example.com",
  SERVER_URL: "http://localhost:8080",
  JWT_SECRET: "a-very-long-secret-key-for-testing",
  TOKEN_TTL_SECONDS: "60",
};

describe("jwt", () => {
  beforeEach(() => {
    loadConfig(testEnv);
  });

  it("mints and verifies a token", () => {
    const token = mintToken("user@example.com", "example.com");
    const payload = verifyToken(token);
    expect(payload.email).toBe("user@example.com");
    expect(payload.domain).toBe("example.com");
  });

  it("rejects tampered token", () => {
    const token = mintToken("user@example.com", "example.com");
    expect(() => verifyToken(token + "x")).toThrow();
  });

  it("rejects expired token", async () => {
    loadConfig({ ...testEnv, TOKEN_TTL_SECONDS: "1" });
    // Manually craft an expired token by signing with a past timestamp
    const jwt = await import("jsonwebtoken");
    const expired = jwt.default.sign(
      { email: "user@example.com", domain: "example.com", iat: 0, exp: 1 },
      "a-very-long-secret-key-for-testing",
    );
    expect(() => verifyToken(expired)).toThrow();
  });
});
