import { describe, it, beforeAll, expect } from "bun:test";
import {
  setupIntegration,
  getLastNDays,
  expectMetricColumns,
} from "@tools/integration-test-helpers";
import { searchPerformance } from "@tools/search-performance";

describe("searchPerformance (integration)", () => {
  beforeAll(() => {
    setupIntegration();
  });

  const dates = getLastNDays(28);

  it("no dimensions returns a single aggregate row", async () => {
    const result = await searchPerformance({
      ...dates,
      dimensions: [],
      filters: [],
      order_by: "clicks",
      order_direction: "desc",
      row_limit: 100,
    });

    expect(result.rows.length).toBe(1);
    expectMetricColumns(result.rows[0] as Record<string, unknown>);
  }, 15_000);

  it("with dimensions returns rows with dimension columns", async () => {
    const result = await searchPerformance({
      ...dates,
      dimensions: ["query", "device"],
      filters: [],
      order_by: "clicks",
      order_direction: "desc",
      row_limit: 5,
    });

    expect(result.rows.length).toBeGreaterThan(0);
    const row = result.rows[0] as Record<string, unknown>;
    expect(row).toHaveProperty("query");
    expect(row).toHaveProperty("device");
    expectMetricColumns(row);
  }, 15_000);

  it("with a filter executes without error", async () => {
    const result = await searchPerformance({
      ...dates,
      dimensions: ["query"],
      filters: [{ dimension: "device", operator: "equals", expression: "MOBILE" }],
      order_by: "impressions",
      order_direction: "desc",
      row_limit: 5,
    });

    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rowCount).toBe(result.rows.length);
  }, 15_000);
});
