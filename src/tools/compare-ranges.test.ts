import { describe, it, expect, beforeEach } from "bun:test";
import { loadConfig } from "@config";
import { testEnv, mockExecuteQuery, testLog } from "@tools/test-helpers";

import { compareRanges } from "@tools/compare-ranges";

describe("compareRanges", () => {
  beforeEach(() => {
    loadConfig(testEnv);
    mockExecuteQuery.mockClear();
    mockExecuteQuery.mockResolvedValue([]);
  });

  it("returns expected structure", async () => {
    const result = await compareRanges(
      {
        period1_start: "2025-01-01",
        period1_end: "2025-01-31",
        period2_start: "2025-02-01",
        period2_end: "2025-02-28",
        dimensions: [],
        filters: [],
        metric: "clicks",
        row_limit: 50,
      },
      testLog,
    );

    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("rowCount");
    expect(result).toHaveProperty("period1");
    expect(result).toHaveProperty("period2");
    expect(result.period1).toEqual({ start: "2025-01-01", end: "2025-01-31" });
    expect(result.period2).toEqual({ start: "2025-02-01", end: "2025-02-28" });
  });

  it("SQL contains period1 and period2 CTEs", async () => {
    await compareRanges(
      {
        period1_start: "2025-01-01",
        period1_end: "2025-01-31",
        period2_start: "2025-02-01",
        period2_end: "2025-02-28",
        dimensions: [],
        filters: [],
        metric: "clicks",
        row_limit: 50,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("period1 AS"));
    expect(sql).toEqual(expect.stringContaining("period2 AS"));
    expect(sql).toEqual(expect.stringContaining("FULL OUTER JOIN"));
  });

  it("passes period dates as params", async () => {
    await compareRanges(
      {
        period1_start: "2025-01-01",
        period1_end: "2025-01-31",
        period2_start: "2025-02-01",
        period2_end: "2025-02-28",
        dimensions: [],
        filters: [],
        metric: "clicks",
        row_limit: 50,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.p1_start).toBe("2025-01-01");
    expect(params.p1_end).toBe("2025-01-31");
    expect(params.p2_start).toBe("2025-02-01");
    expect(params.p2_end).toBe("2025-02-28");
  });

  it("includes dimensions in SQL when provided", async () => {
    await compareRanges(
      {
        period1_start: "2025-01-01",
        period1_end: "2025-01-31",
        period2_start: "2025-02-01",
        period2_end: "2025-02-28",
        dimensions: ["query"],
        filters: [],
        metric: "clicks",
        row_limit: 50,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("GROUP BY query"));
    expect(sql).toEqual(expect.stringContaining("p1.query = p2.query"));
  });

  it("includes filters in SQL when provided", async () => {
    await compareRanges(
      {
        period1_start: "2025-01-01",
        period1_end: "2025-01-31",
        period2_start: "2025-02-01",
        period2_end: "2025-02-28",
        dimensions: [],
        filters: [{ dimension: "query", operator: "contains", expression: "pricing" }],
        metric: "clicks",
        row_limit: 50,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql, params } = call[0] as { sql: string; params: Record<string, unknown> };
    expect(sql).toEqual(expect.stringContaining("LIKE"));
    expect(params.filter_0).toBe("pricing");
  });

  it("computes delta for the specified metric", async () => {
    await compareRanges(
      {
        period1_start: "2025-01-01",
        period1_end: "2025-01-31",
        period2_start: "2025-02-01",
        period2_end: "2025-02-28",
        dimensions: [],
        filters: [],
        metric: "impressions",
        row_limit: 50,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("p2.impressions"));
    expect(sql).toEqual(expect.stringContaining("delta"));
    expect(sql).toEqual(expect.stringContaining("delta_pct"));
  });

  it("applies row_limit", async () => {
    await compareRanges(
      {
        period1_start: "2025-01-01",
        period1_end: "2025-01-31",
        period2_start: "2025-02-01",
        period2_end: "2025-02-28",
        dimensions: [],
        filters: [],
        metric: "clicks",
        row_limit: 25,
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { sql } = call[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("LIMIT 25"));
  });
});
