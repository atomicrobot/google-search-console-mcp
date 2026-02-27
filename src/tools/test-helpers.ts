import { mock } from "bun:test";
import type { QueryOptions } from "@lib/bigquery-client";

export const mockExecuteQuery = mock(
  (_options: QueryOptions, _context?: { tool?: string; user?: string }) =>
    Promise.resolve([] as Record<string, unknown>[]),
);
export const mockGetTableRef = mock(() => "test-project.searchconsole.searchdata_url_impression");

mock.module("@lib/bigquery-client", () => ({
  executeQuery: mockExecuteQuery,
  getTableRef: mockGetTableRef,
}));

export const testEnv = {
  GCP_PROJECT_ID: "test-project",
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  ALLOWED_DOMAIN: "example.com",
  SERVER_URL: "http://localhost:8080",
  JWT_SECRET: "a-very-long-secret-key-for-testing",
};
