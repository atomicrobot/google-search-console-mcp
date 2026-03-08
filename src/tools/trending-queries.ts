import { z } from "zod";
import { executeQuery, getTableRef, ALL_METRICS_SQL, buildUrlFilter } from "@lib/bigquery";
import { getWowPeriods, getMomPeriods } from "@lib/date-utils";
import type { RequestLogger } from "@lib/logger";

export const trendingQueriesInput = z.object({
  comparison: z.enum(["wow", "mom"]).default("wow"),
  metric: z.enum(["clicks", "impressions"]).default("clicks"),
  direction: z.enum(["rising", "falling", "both"]).default("both"),
  min_impressions: z.coerce.number().int().min(0).default(10),
  limit: z.coerce.number().int().min(1).max(10000).default(25),
  url_filter: z.string().optional(),
  url_match_type: z.enum(["equals", "contains", "regex"]).default("contains"),
});

export const TRENDING_QUERIES_DESCRIPTION = `Find queries with the biggest changes in performance — surfaces what's gaining or losing momentum.

Use this for questions like:
- "What queries are trending up this week?"
- "Which queries lost the most clicks month-over-month?"
- "What's rising for /blog URLs?"

Comparison types: wow (week-over-week), mom (month-over-month)
For custom date range comparisons, use compare_date_ranges instead.`;

export type TrendingQueriesInput = z.infer<typeof trendingQueriesInput>;

export async function trendingQueries(input: TrendingQueriesInput, log: RequestLogger) {
  const periods = input.comparison === "wow" ? getWowPeriods() : getMomPeriods();

  const params: Record<string, unknown> = {
    curr_start: periods.current.startDate,
    curr_end: periods.current.endDate,
    prev_start: periods.previous.startDate,
    prev_end: periods.previous.endDate,
    min_impressions: input.min_impressions,
  };

  let urlClause = "";
  if (input.url_filter) {
    urlClause = `AND ${buildUrlFilter("url_filter", input.url_match_type)}`;
    params.url_filter = input.url_filter;
  }

  const directionFilter =
    input.direction === "rising"
      ? "WHERE delta > 0"
      : input.direction === "falling"
        ? "WHERE delta < 0"
        : "";

  const sql = `
    WITH current_period AS (
      SELECT query, ${ALL_METRICS_SQL}
      FROM \`${getTableRef()}\`
      WHERE data_date BETWEEN @curr_start AND @curr_end ${urlClause}
      GROUP BY query
      HAVING impressions >= @min_impressions
    ),
    previous_period AS (
      SELECT query, ${ALL_METRICS_SQL}
      FROM \`${getTableRef()}\`
      WHERE data_date BETWEEN @prev_start AND @prev_end ${urlClause}
      GROUP BY query
    ),
    combined AS (
      SELECT
        COALESCE(c.query, p.query) AS query,
        c.clicks AS curr_clicks, c.impressions AS curr_impressions, c.ctr AS curr_ctr, c.position AS curr_position,
        p.clicks AS prev_clicks, p.impressions AS prev_impressions, p.ctr AS prev_ctr, p.position AS prev_position,
        IFNULL(c.${input.metric}, 0) - IFNULL(p.${input.metric}, 0) AS delta,
        SAFE_DIVIDE(IFNULL(c.${input.metric}, 0) - IFNULL(p.${input.metric}, 0), NULLIF(p.${input.metric}, 0)) AS delta_pct
      FROM current_period c
      FULL OUTER JOIN previous_period p ON c.query = p.query
    )
    SELECT * FROM combined
    ${directionFilter}
    ORDER BY ABS(delta) DESC
    LIMIT ${input.limit}
  `;

  const rows = await executeQuery({ sql, params }, log);

  if (input.direction === "both") {
    const rising = rows.filter((r) => (r.delta as number) > 0);
    const falling = rows.filter((r) => (r.delta as number) < 0);
    return {
      rising,
      falling,
      comparison: input.comparison,
      metric: input.metric,
      periods,
    };
  }

  return {
    rows,
    rowCount: rows.length,
    comparison: input.comparison,
    metric: input.metric,
    direction: input.direction,
    periods,
  };
}
