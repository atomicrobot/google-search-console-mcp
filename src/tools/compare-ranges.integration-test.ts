import { describe, it, beforeAll, expect } from "bun:test";
import { setupIntegration, daysAgo, integrationTestLog } from "@tools/integration-test-helpers";
import { compareRanges } from "@tools/compare-ranges";

describe("compareRanges (integration)", () => {
  beforeAll(() => {
    setupIntegration();
  });

  it("returns rows with p1/p2 columns and delta", async () => {
    const result = await compareRanges(
      {
        period1_start: daysAgo(28),
        period1_end: daysAgo(15),
        period2_start: daysAgo(14),
        period2_end: daysAgo(1),
        dimensions: ["query"],
        filters: [],
        metric: "clicks",
        row_limit: 5,
      },
      integrationTestLog,
    );

    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rowCount).toBe(result.rows.length);

    const row = result.rows[0] as Record<string, unknown>;
    // Period 1 columns
    expect(row).toHaveProperty("p1_clicks");
    expect(row).toHaveProperty("p1_impressions");
    expect(row).toHaveProperty("p1_ctr");
    expect(row).toHaveProperty("p1_position");
    // Period 2 columns
    expect(row).toHaveProperty("p2_clicks");
    expect(row).toHaveProperty("p2_impressions");
    expect(row).toHaveProperty("p2_ctr");
    expect(row).toHaveProperty("p2_position");
    // Delta columns
    expect(row).toHaveProperty("delta");
    expect(row).toHaveProperty("delta_pct");
    // Dimension column
    expect(row).toHaveProperty("query");
  }, 15_000);

  it("period metadata is returned correctly", async () => {
    const p1Start = daysAgo(28);
    const p1End = daysAgo(15);
    const p2Start = daysAgo(14);
    const p2End = daysAgo(1);

    const result = await compareRanges(
      {
        period1_start: p1Start,
        period1_end: p1End,
        period2_start: p2Start,
        period2_end: p2End,
        dimensions: ["query"],
        filters: [],
        metric: "clicks",
        row_limit: 1,
      },
      integrationTestLog,
    );

    expect(result.period1).toEqual({ start: p1Start, end: p1End });
    expect(result.period2).toEqual({ start: p2Start, end: p2End });
  }, 15_000);
});
