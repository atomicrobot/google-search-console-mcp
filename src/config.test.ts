import { describe, it, expect } from "bun:test";
import { loadConfig, getFullTableId } from "@config";

const validEnv = {
  GCP_PROJECT_ID: "my-project",
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  ALLOWED_DOMAIN: "example.com",
  SERVER_URL: "http://localhost:8080",
  JWT_SECRET: "a-very-long-secret-key-for-testing",
  FIRESTORE_OAUTH_DATABASE: "oauth",
};

describe("loadConfig", () => {
  it("loads valid config with defaults", () => {
    const config = loadConfig(validEnv);
    expect(config.GCP_PROJECT_ID).toBe("my-project");
    expect(config.BQ_DATASET).toBe("searchconsole");
    expect(config.BQ_TABLE).toBe("searchdata_url_impression");
    expect(config.MAX_BYTES_BILLED).toBe(1_000_000_000);
    expect(config.PORT).toBe(8080);
    expect(config.TOKEN_TTL_SECONDS).toBe(3600);
  });

  it("overrides defaults", () => {
    const config = loadConfig({
      ...validEnv,
      BQ_DATASET: "custom_ds",
      PORT: "3000",
    });
    expect(config.BQ_DATASET).toBe("custom_ds");
    expect(config.PORT).toBe(3000);
  });

  it("throws on missing required vars", () => {
    expect(() => loadConfig({})).toThrow("Invalid configuration");
  });

  it("throws on invalid SERVER_URL", () => {
    expect(() => loadConfig({ ...validEnv, SERVER_URL: "not-a-url" })).toThrow(
      "Invalid configuration",
    );
  });

  it("accepts DATA_AVAILABLE_FROM as YYYY-MM-DD", () => {
    const config = loadConfig({ ...validEnv, DATA_AVAILABLE_FROM: "2025-02-25" });
    expect(config.DATA_AVAILABLE_FROM).toBe("2025-02-25");
  });

  it("leaves DATA_AVAILABLE_FROM undefined when not set", () => {
    const config = loadConfig(validEnv);
    expect(config.DATA_AVAILABLE_FROM).toBeUndefined();
  });

  it("throws on invalid DATA_AVAILABLE_FROM format", () => {
    expect(() => loadConfig({ ...validEnv, DATA_AVAILABLE_FROM: "Feb 25" })).toThrow(
      "Invalid configuration",
    );
  });
});

describe("getFullTableId", () => {
  it("returns fully-qualified table ID", () => {
    const config = loadConfig(validEnv);
    expect(getFullTableId(config)).toBe("my-project.searchconsole.searchdata_url_impression");
  });
});
