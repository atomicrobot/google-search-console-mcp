import { expect } from "bun:test";
import { loadConfig } from "@config";
import { _resetClient, executeQuery, getTableRef } from "@lib/bigquery";

/**
 * Set up real BigQuery connection for integration tests.
 * Resets the singleton client and loads config from real env vars.
 */
export function setupIntegration(): void {
  _resetClient();
  loadConfig(process.env);
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
    { tool: "integration_test", user: "integration-test" },
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
