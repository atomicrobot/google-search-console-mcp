import { describe, it, beforeAll, expect } from "bun:test";
import {
  setupIntegration,
  getLastNDays,
  fetchSampleUrl,
  expectMetricColumns,
} from "@tools/integration-test-helpers";
import { pagePerformance } from "@tools/page-performance";

describe("pagePerformance (integration)", () => {
  let sampleUrl: string | null = null;

  beforeAll(async () => {
    setupIntegration();
    sampleUrl = await fetchSampleUrl();
  }, 15_000);

  const dates = getLastNDays(28);

  it("returns timeSeries and summary for a known URL", async () => {
    if (!sampleUrl) {
      console.warn("Skipping: no sample URL found in BQ table");
      return;
    }

    const result = await pagePerformance({
      url: sampleUrl,
      url_match_type: "equals",
      ...dates,
    });

    // timeSeries
    expect(Array.isArray(result.timeSeries)).toBe(true);
    expect(result.timeSeries.length).toBeGreaterThan(0);

    const tsRow = result.timeSeries[0] as Record<string, unknown>;
    expect(tsRow).toHaveProperty("date");
    expectMetricColumns(tsRow);

    // summary
    expect(result.summary).not.toBeNull();
    const summary = result.summary as Record<string, unknown>;
    expectMetricColumns(summary);
    expect(summary).toHaveProperty("days_with_data");
    expect(typeof summary.days_with_data).toBe("number");

    // daysWithData matches timeSeries length
    expect(result.daysWithData).toBe(result.timeSeries.length);
  }, 15_000);
});
