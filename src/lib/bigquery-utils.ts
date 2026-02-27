export type MatchType = "equals" | "contains" | "regex";

export function buildUrlFilter(paramName: string, matchType: MatchType): string {
  switch (matchType) {
    case "equals":
      return `url = @${paramName}`;
    case "contains":
      return `url LIKE CONCAT('%', @${paramName}, '%')`;
    case "regex":
      return `REGEXP_CONTAINS(url, @${paramName})`;
  }
}

export function buildQueryFilter(paramName: string, matchType: MatchType): string {
  switch (matchType) {
    case "equals":
      return `query = @${paramName}`;
    case "contains":
      return `query LIKE CONCAT('%', @${paramName}, '%')`;
    case "regex":
      return `REGEXP_CONTAINS(query, @${paramName})`;
  }
}

export type Dimension = "query" | "page" | "country" | "device" | "date";

export function dimensionToColumn(dim: Dimension): string {
  if (dim === "date") return "data_date";
  if (dim === "page") return "url";
  return dim;
}

export interface FilterSpec {
  dimension: "query" | "page" | "country" | "device";
  operator: "equals" | "contains" | "regex" | "not_contains" | "not_equals";
  expression: string;
}

export function buildFilterClause(
  filter: FilterSpec,
  paramIndex: number,
): { clause: string; paramName: string } {
  const paramName = `filter_${paramIndex}`;
  const col = filter.dimension === "page" ? "url" : filter.dimension;

  switch (filter.operator) {
    case "equals":
      return { clause: `${col} = @${paramName}`, paramName };
    case "not_equals":
      return { clause: `${col} != @${paramName}`, paramName };
    case "contains":
      return { clause: `${col} LIKE CONCAT('%', @${paramName}, '%')`, paramName };
    case "not_contains":
      return { clause: `${col} NOT LIKE CONCAT('%', @${paramName}, '%')`, paramName };
    case "regex":
      return { clause: `REGEXP_CONTAINS(${col}, @${paramName})`, paramName };
  }
}

export const METRICS_SQL = {
  clicks: "SUM(clicks) AS clicks",
  impressions: "SUM(impressions) AS impressions",
  ctr: "SAFE_DIVIDE(SUM(clicks), SUM(impressions)) AS ctr",
  position: "SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) + 1 AS position",
} as const;

export const ALL_METRICS_SQL = Object.values(METRICS_SQL).join(", ");

export type Metric = "clicks" | "impressions" | "ctr" | "position";

export function metricToOrderBy(metric: Metric): string {
  return metric;
}
