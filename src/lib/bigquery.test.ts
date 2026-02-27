import { describe, it, expect } from "bun:test";
import {
  buildUrlFilter,
  buildQueryFilter,
  buildFilterClause,
  dimensionToColumn,
  ALL_METRICS_SQL,
} from "@lib/bigquery";

describe("buildUrlFilter", () => {
  it("equals", () => {
    expect(buildUrlFilter("u", "equals")).toBe("url = @u");
  });
  it("contains", () => {
    expect(buildUrlFilter("u", "contains")).toBe("url LIKE CONCAT('%', @u, '%')");
  });
  it("regex", () => {
    expect(buildUrlFilter("u", "regex")).toBe("REGEXP_CONTAINS(url, @u)");
  });
});

describe("buildQueryFilter", () => {
  it("contains", () => {
    expect(buildQueryFilter("q", "contains")).toBe("query LIKE CONCAT('%', @q, '%')");
  });
});

describe("buildFilterClause", () => {
  it("equals filter", () => {
    const result = buildFilterClause(
      { dimension: "query", operator: "equals", expression: "test" },
      0,
    );
    expect(result.clause).toBe("query = @filter_0");
    expect(result.paramName).toBe("filter_0");
  });

  it("not_contains filter", () => {
    const result = buildFilterClause(
      { dimension: "page", operator: "not_contains", expression: "/blog" },
      1,
    );
    expect(result.clause).toBe("url NOT LIKE CONCAT('%', @filter_1, '%')");
  });

  it("regex filter on device", () => {
    const result = buildFilterClause(
      { dimension: "device", operator: "regex", expression: "MOBILE|TABLET" },
      2,
    );
    expect(result.clause).toBe("REGEXP_CONTAINS(device, @filter_2)");
  });
});

describe("dimensionToColumn", () => {
  it("maps date to data_date", () => {
    expect(dimensionToColumn("date")).toBe("data_date");
  });
  it("maps page to url", () => {
    expect(dimensionToColumn("page")).toBe("url");
  });
  it("passes through query", () => {
    expect(dimensionToColumn("query")).toBe("query");
  });
});

describe("ALL_METRICS_SQL", () => {
  it("includes position formula", () => {
    expect(ALL_METRICS_SQL).toContain("SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) + 1");
  });
});
