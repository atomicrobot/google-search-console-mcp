import { describe, expect, it, mock } from "bun:test";

mock.module("@config", () => ({
  getConfig: () => ({ GCP_PROJECT_ID: "my-project" }),
}));

const { parseTraceContext } = await import("@lib/trace");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("parseTraceContext", () => {
  it("parses full header with trace ID, span ID, and flags", () => {
    const result = parseTraceContext("abcdef0123456789abcdef0123456789/def456;o=1");

    expect(result.requestId).toBe("abcdef0123456789abcdef0123456789");
    expect(result["logging.googleapis.com/trace"]).toBe(
      "projects/my-project/traces/abcdef0123456789abcdef0123456789",
    );
    expect(result["logging.googleapis.com/spanId"]).toBe("def456");
  });

  it("parses header with trace ID only (no span)", () => {
    const result = parseTraceContext("abcdef0123456789abcdef0123456789");

    expect(result.requestId).toBe("abcdef0123456789abcdef0123456789");
    expect(result["logging.googleapis.com/trace"]).toBe(
      "projects/my-project/traces/abcdef0123456789abcdef0123456789",
    );
    expect(result["logging.googleapis.com/spanId"]).toBeUndefined();
  });

  it("falls back to UUID when header is undefined", () => {
    const result = parseTraceContext(undefined);

    expect(result.requestId).toMatch(UUID_REGEX);
    expect(result["logging.googleapis.com/trace"]).toBeUndefined();
    expect(result["logging.googleapis.com/spanId"]).toBeUndefined();
  });

  it("falls back to UUID when header is malformed", () => {
    const result = parseTraceContext("not-a-valid-trace-header");

    expect(result.requestId).toMatch(UUID_REGEX);
    expect(result["logging.googleapis.com/trace"]).toBeUndefined();
    expect(result["logging.googleapis.com/spanId"]).toBeUndefined();
  });
});
