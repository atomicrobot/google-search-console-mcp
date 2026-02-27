import { z } from "zod";
import { executeQuery, getTableRef, ALL_METRICS_SQL, buildUrlFilter } from "@lib/bigquery";
import { getExtendedDateRange } from "@lib/date-utils";

export const pagePerformanceInput = z.object({
  url: z.string().min(1),
  url_match_type: z.enum(["equals", "contains", "regex"]).default("contains"),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const PAGE_PERFORMANCE_DESCRIPTION = `Deep dive on a specific page or URL pattern over time. Returns daily time series plus summary stats.

Use this for questions like:
- "How is /pricing performing over time?"
- "Show me the trend for our homepage"
- "Daily clicks and position for blog posts"

Default date range: last 90 days (longer than other tools for trend visibility).
To find top queries for a page, use top_queries with the same url_filter.`;

export type PagePerformanceInput = z.infer<typeof pagePerformanceInput>;

export async function pagePerformance(input: PagePerformanceInput, user?: string) {
  const defaults = getExtendedDateRange();
  const startDate = input.start_date || defaults.startDate;
  const endDate = input.end_date || defaults.endDate;

  const params: Record<string, unknown> = {
    start_date: startDate,
    end_date: endDate,
    url_filter: input.url,
  };

  const urlClause = buildUrlFilter("url_filter", input.url_match_type);

  // Daily time series
  const timeSeriesSql = `
    SELECT data_date AS date, ${ALL_METRICS_SQL}
    FROM \`${getTableRef()}\`
    WHERE data_date BETWEEN @start_date AND @end_date AND ${urlClause}
    GROUP BY data_date
    ORDER BY data_date ASC
  `;

  // Summary stats
  const summarySql = `
    SELECT
      ${ALL_METRICS_SQL},
      MIN(SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) + 1) OVER() AS min_position,
      MAX(SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) + 1) OVER() AS max_position,
      COUNT(DISTINCT data_date) AS days_with_data
    FROM \`${getTableRef()}\`
    WHERE data_date BETWEEN @start_date AND @end_date AND ${urlClause}
  `;

  const [timeSeries, summary] = await Promise.all([
    executeQuery({ sql: timeSeriesSql, params }, { tool: "page_performance", user }),
    executeQuery({ sql: summarySql, params }, { tool: "page_performance", user }),
  ]);

  return {
    timeSeries,
    summary: summary[0] || null,
    dateRange: { startDate, endDate },
    daysWithData: timeSeries.length,
  };
}
