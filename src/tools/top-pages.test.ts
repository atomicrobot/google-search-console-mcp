import { describe, it, expect, beforeEach } from "bun:test";
import { loadConfig } from "@config";
import { testEnv, mockExecuteQuery } from "@tools/test-helpers";

import { topPages } from "@tools/top-pages";

describe("topPages", () => {
  beforeEach(() => {
    loadConfig(testEnv);
    mockExecuteQuery.mockClear();
    mockExecuteQuery.mockResolvedValue([]);
  });

  it("returns expected structure with defaults", async () => {
    const result = await topPages({
      metric: "clicks",
      limit: 20,
      url_match_type: "contains",
    });

    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("rowCount");
    expect(result).toHaveProperty("dateRange");
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it("applies default date range when not specified", async () => {
    await topPages({
      metric: "clicks",
      limit: 20,
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.start_date).toBeDefined();
    expect(params.end_date).toBeDefined();
  });

  it("SQL groups by url and orders by metric DESC for clicks", async () => {
    await topPages({
      metric: "clicks",
      limit: 10,
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("GROUP BY url"));
    expect(sql).toEqual(expect.stringContaining("ORDER BY clicks DESC"));
    expect(sql).toEqual(expect.stringContaining("LIMIT 10"));
  });

  it("orders by position ASC when metric is position", async () => {
    await topPages({
      metric: "position",
      limit: 20,
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("ORDER BY position ASC"));
  });

  it("includes url_filter in SQL when provided", async () => {
    await topPages({
      metric: "clicks",
      limit: 20,
      url_filter: "/blog",
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { sql, params } = call[0] as { sql: string; params: Record<string, unknown> };
    expect(sql).toEqual(expect.stringContaining("LIKE"));
    expect(params.url_filter).toBe("/blog");
  });

  it("uses provided date range", async () => {
    await topPages({
      start_date: "2025-03-01",
      end_date: "2025-03-31",
      metric: "impressions",
      limit: 20,
      url_match_type: "contains",
    });

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.start_date).toBe("2025-03-01");
    expect(params.end_date).toBe("2025-03-31");
  });

  it("returns rows from executeQuery", async () => {
    const mockRows = [
      { page: "https://example.com/pricing", clicks: 500 },
      { page: "https://example.com/about", clicks: 300 },
    ];
    mockExecuteQuery.mockResolvedValue(mockRows);

    const result = await topPages({
      metric: "clicks",
      limit: 20,
      url_match_type: "contains",
    });

    expect(result.rows).toEqual(mockRows);
    expect(result.rowCount).toBe(2);
  });
});
