import { describe, it, expect, beforeEach } from "bun:test";
import { loadConfig } from "@config";
import { testEnv, mockExecuteQuery, testLog } from "@tools/test-helpers";

import { searchPerformance } from "@tools/search-performance";

describe("searchPerformance", () => {
  beforeEach(() => {
    loadConfig(testEnv);
    mockExecuteQuery.mockClear();
    mockExecuteQuery.mockResolvedValue([]);
  });

  it("returns expected structure with defaults", async () => {
    const result = await searchPerformance(
      {
        dimensions: [],
        filters: [],
        order_by: "clicks",
        order_direction: "desc",
        row_limit: 100,
      },
      testLog,
    );

    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("rowCount");
    expect(result).toHaveProperty("dateRange");
    expect(result.dateRange).toHaveProperty("startDate");
    expect(result.dateRange).toHaveProperty("endDate");
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it("applies default date range when not specified", async () => {
    await searchPerformance(
      {
        dimensions: [],
        filters: [],
        order_by: "clicks",
        order_direction: "desc",
        row_limit: 100,
      },
      testLog,
    );

    expect(mockExecuteQuery).toHaveBeenCalledTimes(1);
    const call = mockExecuteQuery.mock.calls[0];
    const { sql, params } = call[0] as { sql: string; params: Record<string, unknown> };
    expect(params.start_date).toBeDefined();
    expect(params.end_date).toBeDefined();
    expect(sql).toEqual(expect.stringContaining("data_date BETWEEN @start_date AND @end_date"));
  });

  it("uses provided date range", async () => {
    await searchPerformance(
      {
        start_date: "2025-01-01",
        end_date: "2025-01-31",
        dimensions: [],
        filters: [],
        order_by: "clicks",
        order_direction: "desc",
        row_limit: 100,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.start_date).toBe("2025-01-01");
    expect(params.end_date).toBe("2025-01-31");
  });

  it("includes dimensions in SQL", async () => {
    await searchPerformance(
      {
        dimensions: ["query", "page"],
        filters: [],
        order_by: "clicks",
        order_direction: "desc",
        row_limit: 100,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("query"));
    expect(sql).toEqual(expect.stringContaining("GROUP BY"));
  });

  it("includes filters in SQL", async () => {
    await searchPerformance(
      {
        dimensions: [],
        filters: [{ dimension: "query", operator: "contains", expression: "pricing" }],
        order_by: "clicks",
        order_direction: "desc",
        row_limit: 100,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql, params } = call[0] as { sql: string; params: Record<string, unknown> };
    expect(sql).toEqual(expect.stringContaining("LIKE"));
    expect(params.filter_0).toBe("pricing");
  });

  it("applies order_by and order_direction", async () => {
    await searchPerformance(
      {
        dimensions: [],
        filters: [],
        order_by: "impressions",
        order_direction: "asc",
        row_limit: 50,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("ORDER BY impressions asc"));
    expect(sql).toEqual(expect.stringContaining("LIMIT 50"));
  });

  it("returns rows from executeQuery", async () => {
    const mockRows = [{ query: "test", clicks: 100 }];
    mockExecuteQuery.mockResolvedValue(mockRows);

    const result = await searchPerformance(
      {
        dimensions: ["query"],
        filters: [],
        order_by: "clicks",
        order_direction: "desc",
        row_limit: 100,
      },
      testLog,
    );

    expect(result.rows).toEqual(mockRows);
    expect(result.rowCount).toBe(1);
  });
});
