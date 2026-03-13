import { z } from "zod";
import {
  executeQuery,
  getTableRef,
  ALL_METRICS_SQL,
  buildUrlFilter,
  buildQueryFilter,
} from "@lib/bigquery";
import { getDefaultDateRange } from "@lib/date-utils";
import type { RequestLogger } from "@lib/logger";

export const topQueriesInput = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Start date in YYYY-MM-DD format (default: 28 days ago)"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("End date in YYYY-MM-DD format (default: today)"),
  metric: z
    .enum(["clicks", "impressions", "ctr", "position"])
    .default("clicks")
    .describe("Metric to rank queries by"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(20)
    .describe("Maximum number of queries to return"),
  url_filter: z.string().optional().describe("Filter to pages matching this URL or URL pattern"),
  url_match_type: z
    .enum(["equals", "contains", "regex"])
    .default("contains")
    .describe("How to match the url_filter: exact match, substring, or regex"),
  query_filter: z
    .string()
    .optional()
    .describe("Filter to queries containing this search term text"),
});

export const TOP_QUERIES_DESCRIPTION = `Get top search queries ranked by a metric.

Use this for questions like:
- "What are our top search queries?"
- "Top queries driving traffic to /pricing"
- "What queries containing 'how to' get the most impressions?"

Returns: Ranked list of queries with clicks, impressions, CTR, and position.
Default: Top 20 queries by clicks over last 28 days.`;

export type TopQueriesInput = z.infer<typeof topQueriesInput>;

export async function topQueries(input: TopQueriesInput, log: RequestLogger) {
  const defaults = getDefaultDateRange();
  const startDate = input.start_date || defaults.startDate;
  const endDate = input.end_date || defaults.endDate;

  const params: Record<string, unknown> = {
    start_date: startDate,
    end_date: endDate,
  };

  const whereClauses = ["data_date BETWEEN @start_date AND @end_date"];

  if (input.url_filter) {
    whereClauses.push(buildUrlFilter("url_filter", input.url_match_type));
    params.url_filter = input.url_filter;
  }

  if (input.query_filter) {
    whereClauses.push(buildQueryFilter("query_filter", "contains"));
    params.query_filter = input.query_filter;
  }

  const orderDirection = input.metric === "position" ? "ASC" : "DESC";

  const sql = `
    SELECT query, ${ALL_METRICS_SQL}
    FROM \`${getTableRef()}\`
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY query
    ORDER BY ${input.metric} ${orderDirection}
    LIMIT ${input.limit}
  `;

  const rows = await executeQuery({ sql, params }, log);
  return { rows, rowCount: rows.length, dateRange: { startDate, endDate } };
}
