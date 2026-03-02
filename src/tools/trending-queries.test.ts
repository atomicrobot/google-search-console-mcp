import { describe, it, expect, beforeEach } from "bun:test";
import { loadConfig } from "@config";
import { testEnv, mockExecuteQuery } from "@tools/test-helpers";

import { trendingQueries } from "@tools/trending-queries";

describe("trendingQueries", () => {
  beforeEach(() => {
    loadConfig(testEnv);
    mockExecuteQuery.mockClear();
    mockExecuteQuery.mockResolvedValue([]);
  });

  it("returns rising/falling structure when direction is both", async () => {
    const result = await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "both",
      min_impressions: 10,
      limit: 25,
      url_match_type: "contains",
    });

    expect(result).toHaveProperty("rising");
    expect(result).toHaveProperty("falling");
    expect(result).toHaveProperty("comparison");
    expect(result).toHaveProperty("metric");
    expect(result).toHaveProperty("periods");
    expect(result.comparison).toBe("wow");
    expect(result.metric).toBe("clicks");
  });

  it("returns rows structure when direction is rising", async () => {
    const result = await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "rising",
      min_impressions: 10,
      limit: 25,
      url_match_type: "contains",
    });

    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("rowCount");
    expect(result).toHaveProperty("direction");
    expect((result as { direction: string }).direction).toBe("rising");
  });

  it("SQL contains current_period and previous_period CTEs", async () => {
    await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "both",
      min_impressions: 10,
      limit: 25,
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("current_period AS"));
    expect(sql).toEqual(expect.stringContaining("previous_period AS"));
    expect(sql).toEqual(expect.stringContaining("FULL OUTER JOIN"));
  });

  it("includes min_impressions in params", async () => {
    await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "both",
      min_impressions: 50,
      limit: 25,
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.min_impressions).toBe(50);
  });

  it("applies WHERE delta > 0 for rising direction", async () => {
    await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "rising",
      min_impressions: 10,
      limit: 25,
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("WHERE delta > 0"));
  });

  it("applies WHERE delta < 0 for falling direction", async () => {
    await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "falling",
      min_impressions: 10,
      limit: 25,
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("WHERE delta < 0"));
  });

  it("includes url_filter when provided", async () => {
    await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "both",
      min_impressions: 10,
      limit: 25,
      url_filter: "/blog",
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { sql, params } = call[0] as { sql: string; params: Record<string, unknown> };
    expect(sql).toEqual(expect.stringContaining("LIKE"));
    expect(params.url_filter).toBe("/blog");
  });

  it("applies limit to SQL", async () => {
    await trendingQueries({
      comparison: "mom",
      metric: "impressions",
      direction: "both",
      min_impressions: 10,
      limit: 15,
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("LIMIT 15"));
  });

  it("splits rows into rising and falling when direction is both", async () => {
    const mockRows = [
      { query: "rising-query", delta: 50 },
      { query: "falling-query", delta: -30 },
    ];
    mockExecuteQuery.mockResolvedValue(mockRows);

    const result = await trendingQueries({
      comparison: "wow",
      metric: "clicks",
      direction: "both",
      min_impressions: 10,
      limit: 25,
      url_match_type: "contains",
    });

    const bothResult = result as { rising: unknown[]; falling: unknown[] };
    expect(bothResult.rising).toEqual([{ query: "rising-query", delta: 50 }]);
    expect(bothResult.falling).toEqual([{ query: "falling-query", delta: -30 }]);
  });

  it("uses mom periods when comparison is mom", async () => {
    const result = await trendingQueries({
      comparison: "mom",
      metric: "clicks",
      direction: "both",
      min_impressions: 10,
      limit: 25,
      url_match_type: "contains",
    });

    expect(result.comparison).toBe("mom");
    expect(result.periods).toBeDefined();
  });
});
