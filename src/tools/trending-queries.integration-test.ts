import { describe, it, beforeAll, expect } from "bun:test";
import { setupIntegration } from "@tools/integration-test-helpers";
import { trendingQueries } from "@tools/trending-queries";

describe("trendingQueries (integration)", () => {
  beforeAll(() => {
    setupIntegration();
  });

  it("direction=both returns rising and falling arrays with correct deltas", async () => {
    const result = await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "both",
      min_impressions: 10,
      limit: 10,
      url_match_type: "contains",
    });

    expect(result).toHaveProperty("rising");
    expect(result).toHaveProperty("falling");
    expect(result).toHaveProperty("periods");
    expect(Array.isArray(result.rising)).toBe(true);
    expect(Array.isArray(result.falling)).toBe(true);

    // Rising rows should have delta > 0
    for (const row of result.rising as Record<string, unknown>[]) {
      expect(row).toHaveProperty("query");
      expect(row).toHaveProperty("delta");
      expect((row.delta as number) > 0).toBe(true);
    }

    // Falling rows should have delta < 0
    for (const row of result.falling as Record<string, unknown>[]) {
      expect(row).toHaveProperty("query");
      expect(row).toHaveProperty("delta");
      expect((row.delta as number) < 0).toBe(true);
    }
  }, 15_000);

  it("direction=rising returns only rows with positive delta", async () => {
    const result = await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "rising",
      min_impressions: 10,
      limit: 5,
      url_match_type: "contains",
    });

    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("rowCount");
    const rows = result.rows as Record<string, unknown>[];

    for (const row of rows) {
      expect((row.delta as number) > 0).toBe(true);
    }
  }, 15_000);

  it("periods object has current and previous date ranges", async () => {
    const result = await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "both",
      min_impressions: 10,
      limit: 1,
      url_match_type: "contains",
    });

    expect(result.periods).toHaveProperty("current");
    expect(result.periods).toHaveProperty("previous");
    expect(result.periods.current).toHaveProperty("startDate");
    expect(result.periods.current).toHaveProperty("endDate");
    expect(result.periods.previous).toHaveProperty("startDate");
    expect(result.periods.previous).toHaveProperty("endDate");
  }, 15_000);
});
