import { describe, it, beforeAll, expect } from "bun:test";
import {
  setupIntegration,
  getLastNDays,
  expectMetricColumns,
  integrationTestLog,
} from "@tools/integration-test-helpers";
import { topQueries } from "@tools/top-queries";

describe("topQueries (integration)", () => {
  beforeAll(() => {
    setupIntegration();
  });

  const dates = getLastNDays(28);

  it("returns rows with query and metric columns", async () => {
    const result = await topQueries(
      { ...dates, metric: "clicks", limit: 5, url_match_type: "contains" },
      integrationTestLog,
    );

    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.length).toBeLessThanOrEqual(5);
    expect(result.rowCount).toBe(result.rows.length);

    const row = result.rows[0] as Record<string, unknown>;
    expect(row).toHaveProperty("query");
    expect(typeof row.query === "string" || row.query === null).toBe(true);
    expectMetricColumns(row);
  }, 15_000);

  it("respects the limit parameter", async () => {
    const result = await topQueries(
      { ...dates, metric: "impressions", limit: 3, url_match_type: "contains" },
      integrationTestLog,
    );

    expect(result.rows.length).toBeLessThanOrEqual(3);
  }, 15_000);

  it("returns rows sorted by the chosen metric descending", async () => {
    const result = await topQueries(
      { ...dates, metric: "clicks", limit: 10, url_match_type: "contains" },
      integrationTestLog,
    );

    const clicks = result.rows.map((r) => (r as Record<string, unknown>).clicks as number);
    for (let i = 1; i < clicks.length; i++) {
      expect(clicks[i]).toBeLessThanOrEqual(clicks[i - 1]);
    }
  }, 15_000);
});
