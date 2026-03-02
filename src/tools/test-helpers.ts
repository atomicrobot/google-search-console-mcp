import { mock } from "bun:test";
import { createRequestLogger } from "@lib/logger";

export const mockExecuteQuery = mock(() => Promise.resolve([] as Record<string, unknown>[]));
export const mockGetTableRef = mock(() => "test-project.searchconsole.searchdata_url_impression");

mock.module("@lib/bigquery-client", () => ({
  executeQuery: mockExecuteQuery,
  getTableRef: mockGetTableRef,
}));

export const testLog = createRequestLogger({ tool: "test", email: "test@example.com" });

export const testEnv = {
  GCP_PROJECT_ID: "test-project",
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  ALLOWED_DOMAIN: "example.com",
  SERVER_URL: "http://localhost:8080",
  JWT_SECRET: "a-very-long-secret-key-for-testing",
};
