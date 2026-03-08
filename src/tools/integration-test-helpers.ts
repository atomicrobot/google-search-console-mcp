import { expect } from "bun:test";
import { loadConfig } from "@config";
import { _resetClient, executeQuery, getTableRef } from "@lib/bigquery";
import { createRequestLogger } from "@lib/logger";

/** Request logger for integration test log attribution. */
export const integrationTestLog = createRequestLogger({
  tool: "integration_test",
  email: "integration-test",
});

/**
 * Set up real BigQuery connection for integration tests.
 * Resets the singleton client and loads config from real env vars.
 */
export function setupIntegration(): void {
  _resetClient();
  loadConfig({
    ...process.env,
    // Provide defaults for vars not needed by BigQuery but required by config schema
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "unused-in-integration-tests",
    GOOGLE_OAUTH_CLIENT_SECRET:
      process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "unused-in-integration-tests",
    ALLOWED_DOMAIN: process.env.ALLOWED_DOMAIN ?? "test.com",
    SERVER_URL: process.env.SERVER_URL ?? "http://localhost:8080",
    JWT_SECRET: process.env.JWT_SECRET ?? "integration-test-secret-not-real",
    FIRESTORE_OAUTH_DATABASE: process.env.FIRESTORE_OAUTH_DATABASE ?? "unused-in-integration-tests",
  });
}

/** Returns a YYYY-MM-DD string for n days ago. */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Returns start_date / end_date for the last n days (ending yesterday). */
export function getLastNDays(n: number): { start_date: string; end_date: string } {
  return {
    start_date: daysAgo(n),
    end_date: daysAgo(1),
  };
}

/** Fetches a single URL from the BQ table (for page-performance tests). */
export async function fetchSampleUrl(): Promise<string | null> {
  const sql = `
    SELECT url
    FROM \`${getTableRef()}\`
    WHERE data_date >= @recent_date
    GROUP BY url
    HAVING SUM(impressions) > 10
    ORDER BY SUM(impressions) DESC
    LIMIT 1
  `;
  const rows = await executeQuery(
    { sql, params: { recent_date: daysAgo(14) } },
    integrationTestLog,
  );
  return rows.length > 0 ? (rows[0].url as string) : null;
}

/** Asserts that a row has the standard metric columns as numbers. */
export function expectMetricColumns(row: Record<string, unknown>): void {
  for (const col of ["clicks", "impressions", "ctr", "position"]) {
    expect(row).toHaveProperty(col);
    expect(typeof row[col]).toBe("number");
  }
}
