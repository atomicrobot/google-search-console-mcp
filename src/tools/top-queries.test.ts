import { describe, it, expect, beforeEach } from "bun:test";
import { loadConfig } from "@config";
import { testEnv, mockExecuteQuery, testLog } from "@tools/test-helpers";

import { topQueries } from "@tools/top-queries";

describe("topQueries", () => {
  beforeEach(() => {
    loadConfig(testEnv);
    mockExecuteQuery.mockClear();
    mockExecuteQuery.mockResolvedValue([]);
  });

  it("returns expected structure with defaults", async () => {
    const result = await topQueries(
      { metric: "clicks", limit: 20, url_match_type: "contains" },
      testLog,
    );

    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("rowCount");
    expect(result).toHaveProperty("dateRange");
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it("SQL groups by query and orders by metric", async () => {
    await topQueries({ metric: "impressions", limit: 10, url_match_type: "contains" }, testLog);

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("GROUP BY query"));
    expect(sql).toEqual(expect.stringContaining("ORDER BY impressions DESC"));
    expect(sql).toEqual(expect.stringContaining("LIMIT 10"));
  });

  it("orders by position ASC when metric is position", async () => {
    await topQueries({ metric: "position", limit: 20, url_match_type: "contains" }, testLog);

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("ORDER BY position ASC"));
  });

  it("includes url_filter when provided", async () => {
    await topQueries(
      { metric: "clicks", limit: 20, url_filter: "/pricing", url_match_type: "contains" },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql, params } = call[0] as { sql: string; params: Record<string, unknown> };
    expect(sql).toEqual(expect.stringContaining("LIKE"));
    expect(params.url_filter).toBe("/pricing");
  });

  it("includes query_filter when provided", async () => {
    await topQueries(
      { metric: "clicks", limit: 20, query_filter: "how to", url_match_type: "contains" },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql, params } = call[0] as { sql: string; params: Record<string, unknown> };
    expect(sql).toEqual(expect.stringContaining("LIKE"));
    expect(params.query_filter).toBe("how to");
  });

  it("uses provided date range", async () => {
    await topQueries(
      {
        start_date: "2025-02-01",
        end_date: "2025-02-28",
        metric: "clicks",
        limit: 20,
        url_match_type: "contains",
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.start_date).toBe("2025-02-01");
    expect(params.end_date).toBe("2025-02-28");
  });

  it("returns rows from executeQuery", async () => {
    const mockRows = [{ query: "pricing", clicks: 200 }];
    mockExecuteQuery.mockResolvedValue(mockRows);

    const result = await topQueries(
      { metric: "clicks", limit: 20, url_match_type: "contains" },
      testLog,
    );

    expect(result.rows).toEqual(mockRows);
    expect(result.rowCount).toBe(1);
  });
});
