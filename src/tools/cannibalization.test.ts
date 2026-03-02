import { describe, it, expect, beforeEach } from "bun:test";
import { loadConfig } from "@config";
import { testEnv, mockExecuteQuery, testLog } from "@tools/test-helpers";

import { cannibalization } from "@tools/cannibalization";

describe("cannibalization", () => {
  beforeEach(() => {
    loadConfig(testEnv);
    mockExecuteQuery.mockClear();
    mockExecuteQuery.mockResolvedValue([]);
  });

  it("returns expected structure with defaults", async () => {
    const result = await cannibalization(
      {
        min_pages: 2,
        min_impressions: 10,
        query_match_type: "contains",
        url_match_type: "contains",
        limit: 25,
      },
      testLog,
    );

    expect(result).toHaveProperty("queries");
    expect(result).toHaveProperty("queryCount");
    expect(result).toHaveProperty("dateRange");
    expect(result.queries).toEqual([]);
    expect(result.queryCount).toBe(0);
  });

  it("applies default date range when not specified", async () => {
    await cannibalization(
      {
        min_pages: 2,
        min_impressions: 10,
        query_match_type: "contains",
        url_match_type: "contains",
        limit: 25,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.start_date).toBeDefined();
    expect(params.end_date).toBeDefined();
  });

  it("SQL contains cannibalized_queries CTE with page count filter", async () => {
    await cannibalization(
      {
        min_pages: 3,
        min_impressions: 10,
        query_match_type: "contains",
        url_match_type: "contains",
        limit: 25,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql, params } = call[0] as { sql: string; params: Record<string, unknown> };
    expect(sql).toEqual(expect.stringContaining("page_query_metrics AS"));
    expect(sql).toEqual(expect.stringContaining("cannibalized_queries AS"));
    expect(sql).toEqual(expect.stringContaining("COUNT(DISTINCT page) >= @min_pages"));
    expect(sql).toEqual(expect.stringContaining("SUM(impressions) >= @min_impressions"));
    expect(params.min_pages).toBe(3);
    expect(params.min_impressions).toBe(10);
  });

  it("includes query_filter when provided", async () => {
    await cannibalization(
      {
        min_pages: 2,
        min_impressions: 10,
        query_filter: "guide",
        query_match_type: "contains",
        url_match_type: "contains",
        limit: 25,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql, params } = call[0] as { sql: string; params: Record<string, unknown> };
    expect(sql).toEqual(expect.stringContaining("LIKE"));
    expect(params.query_filter).toBe("guide");
  });

  it("includes url_filter when provided", async () => {
    await cannibalization(
      {
        min_pages: 2,
        min_impressions: 10,
        url_filter: "/blog",
        url_match_type: "contains",
        query_match_type: "contains",
        limit: 25,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.url_filter).toBe("/blog");
  });

  it("uses provided date range", async () => {
    await cannibalization(
      {
        start_date: "2025-01-01",
        end_date: "2025-01-31",
        min_pages: 2,
        min_impressions: 10,
        query_match_type: "contains",
        url_match_type: "contains",
        limit: 25,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.start_date).toBe("2025-01-01");
    expect(params.end_date).toBe("2025-01-31");
  });

  it("applies limit to SQL", async () => {
    await cannibalization(
      {
        min_pages: 2,
        min_impressions: 10,
        query_match_type: "contains",
        url_match_type: "contains",
        limit: 10,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("LIMIT 10"));
  });

  it("groups rows by query in result", async () => {
    const mockRows = [
      {
        query: "pricing",
        page_count: 2,
        total_impressions: 500,
        page: "/pricing",
        clicks: 100,
        impressions: 300,
        ctr: 0.33,
        position: 2.1,
      },
      {
        query: "pricing",
        page_count: 2,
        total_impressions: 500,
        page: "/plans",
        clicks: 50,
        impressions: 200,
        ctr: 0.25,
        position: 4.5,
      },
      {
        query: "guide",
        page_count: 3,
        total_impressions: 800,
        page: "/guide",
        clicks: 200,
        impressions: 400,
        ctr: 0.5,
        position: 1.5,
      },
    ];
    mockExecuteQuery.mockResolvedValue(mockRows);

    const result = await cannibalization(
      {
        min_pages: 2,
        min_impressions: 10,
        query_match_type: "contains",
        url_match_type: "contains",
        limit: 25,
      },
      testLog,
    );

    expect(result.queryCount).toBe(2);
    expect(result.queries).toHaveLength(2);

    const pricingGroup = result.queries.find((q) => q.query === "pricing");
    expect(pricingGroup).toBeDefined();
    expect(pricingGroup!.pageCount).toBe(2);
    expect(pricingGroup!.totalImpressions).toBe(500);
    expect(pricingGroup!.pages).toHaveLength(2);

    const guideGroup = result.queries.find((q) => q.query === "guide");
    expect(guideGroup).toBeDefined();
    expect(guideGroup!.pageCount).toBe(3);
    expect(guideGroup!.pages).toHaveLength(1);
  });
});
