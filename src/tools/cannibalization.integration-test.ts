import { describe, it, beforeAll, expect } from "bun:test";
import { setupIntegration, getLastNDays } from "@tools/integration-test-helpers";
import { cannibalization } from "@tools/cannibalization";

describe("cannibalization (integration)", () => {
  beforeAll(() => {
    setupIntegration();
  });

  const dates = getLastNDays(28);

  it("returns grouped queries with pages", async () => {
    const result = await cannibalization({
      ...dates,
      min_pages: 2,
      min_impressions: 10,
      limit: 5,
      query_match_type: "contains",
      url_match_type: "contains",
    });

    expect(Array.isArray(result.queries)).toBe(true);
    expect(result.queryCount).toBe(result.queries.length);

    if (result.queries.length > 0) {
      const entry = result.queries[0];
      expect(entry).toHaveProperty("query");
      expect(typeof entry.query).toBe("string");
      expect(entry).toHaveProperty("pageCount");
      expect(typeof entry.pageCount).toBe("number");
      expect(entry).toHaveProperty("totalImpressions");
      expect(typeof entry.totalImpressions).toBe("number");
      expect(Array.isArray(entry.pages)).toBe(true);
      expect(entry.pages.length).toBeGreaterThanOrEqual(2);
    }
  }, 15_000);

  it("pageCount is at least min_pages", async () => {
    const minPages = 3;
    const result = await cannibalization({
      ...dates,
      min_pages: minPages,
      min_impressions: 10,
      limit: 10,
      query_match_type: "contains",
      url_match_type: "contains",
    });

    for (const entry of result.queries) {
      expect(entry.pageCount).toBeGreaterThanOrEqual(minPages);
      expect(entry.pages.length).toBeGreaterThanOrEqual(minPages);
    }
  }, 15_000);
});
