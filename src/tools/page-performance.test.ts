import { describe, it, expect, beforeEach } from "bun:test";
import { loadConfig } from "@config";
import { testEnv, mockExecuteQuery, testLog } from "@tools/test-helpers";

import { pagePerformance } from "@tools/page-performance";

describe("pagePerformance", () => {
  beforeEach(() => {
    loadConfig(testEnv);
    mockExecuteQuery.mockClear();
    mockExecuteQuery.mockResolvedValue([]);
  });

  it("returns expected structure", async () => {
    const result = await pagePerformance({ url: "/pricing", url_match_type: "contains" }, testLog);

    expect(result).toHaveProperty("timeSeries");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("dateRange");
    expect(result).toHaveProperty("daysWithData");
    expect(result.dateRange).toHaveProperty("startDate");
    expect(result.dateRange).toHaveProperty("endDate");
  });

  it("executes two queries (timeSeries and summary)", async () => {
    await pagePerformance({ url: "/pricing", url_match_type: "contains" }, testLog);

    expect(mockExecuteQuery).toHaveBeenCalledTimes(2);
  });

  it("time series SQL groups by data_date and orders ASC", async () => {
    await pagePerformance({ url: "/pricing", url_match_type: "contains" }, testLog);

    const timeSeriesCall = mockExecuteQuery.mock.calls[0];
    const { sql } = timeSeriesCall[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("GROUP BY data_date"));
    expect(sql).toEqual(expect.stringContaining("ORDER BY data_date ASC"));
  });

  it("summary SQL includes aggregate stats", async () => {
    await pagePerformance({ url: "/pricing", url_match_type: "contains" }, testLog);

    const summaryCall = mockExecuteQuery.mock.calls[1];
    const { sql } = summaryCall[0] as { sql: string };
    expect(sql).toEqual(expect.stringContaining("MIN"));
    expect(sql).toEqual(expect.stringContaining("MAX"));
    expect(sql).toEqual(expect.stringContaining("days_with_data"));
  });

  it("passes url_filter as param", async () => {
    await pagePerformance(
      { url: "https://example.com/pricing", url_match_type: "equals" },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.url_filter).toBe("https://example.com/pricing");
  });

  it("uses provided date range", async () => {
    await pagePerformance(
      {
        url: "/blog",
        url_match_type: "contains",
        start_date: "2025-01-01",
        end_date: "2025-03-31",
      },
      testLog,
    );

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.start_date).toBe("2025-01-01");
    expect(params.end_date).toBe("2025-03-31");
  });

  it("applies extended default date range when dates not specified", async () => {
    await pagePerformance({ url: "/pricing", url_match_type: "contains" }, testLog);

    const call = mockExecuteQuery.mock.calls[0];
    const { params } = call[0] as { params: Record<string, unknown> };
    expect(params.start_date).toBeDefined();
    expect(params.end_date).toBeDefined();
  });

  it("returns summary as null when no summary rows", async () => {
    mockExecuteQuery.mockResolvedValue([]);

    const result = await pagePerformance({ url: "/pricing", url_match_type: "contains" }, testLog);

    expect(result.summary).toBeNull();
  });

  it("returns timeSeries rows and daysWithData count", async () => {
    const mockTimeSeries = [
      { date: "2025-01-01", clicks: 10 },
      { date: "2025-01-02", clicks: 15 },
    ];
    const mockSummary = [{ clicks: 25, days_with_data: 2 }];

    mockExecuteQuery.mockResolvedValueOnce(mockTimeSeries).mockResolvedValueOnce(mockSummary);

    const result = await pagePerformance({ url: "/pricing", url_match_type: "contains" }, testLog);

    expect(result.timeSeries).toEqual(mockTimeSeries);
    expect(result.daysWithData).toBe(2);
    expect(result.summary).toEqual(mockSummary[0]);
  });
});
