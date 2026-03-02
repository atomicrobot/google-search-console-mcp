import { describe, it, beforeAll, expect } from "bun:test";
import {
  setupIntegration,
  getLastNDays,
  expectMetricColumns,
  integrationTestLog,
} from "@tools/integration-test-helpers";
import { topPages } from "@tools/top-pages";

describe("topPages (integration)", () => {
  beforeAll(() => {
    setupIntegration();
  });

  const dates = getLastNDays(28);

  it("returns rows with page and metric columns", async () => {
    const result = await topPages(
      { ...dates, metric: "clicks", limit: 5, url_match_type: "contains" },
      integrationTestLog,
    );

    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.length).toBeLessThanOrEqual(5);
    expect(result.rowCount).toBe(result.rows.length);

    const row = result.rows[0] as Record<string, unknown>;
    expect(row).toHaveProperty("page");
    expect(typeof row.page === "string" || row.page === null).toBe(true);
    expectMetricColumns(row);
  }, 15_000);

  it("respects the limit parameter", async () => {
    const result = await topPages(
      { ...dates, metric: "impressions", limit: 3, url_match_type: "contains" },
      integrationTestLog,
    );

    expect(result.rows.length).toBeLessThanOrEqual(3);
  }, 15_000);
});
