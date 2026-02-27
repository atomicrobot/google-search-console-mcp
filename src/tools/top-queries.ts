import { z } from "zod";
import {
  executeQuery,
  getTableRef,
  ALL_METRICS_SQL,
  buildUrlFilter,
  buildQueryFilter,
} from "@lib/bigquery";
import { getDefaultDateRange } from "@lib/date-utils";

export const topQueriesInput = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  metric: z.enum(["clicks", "impressions", "ctr", "position"]).default("clicks"),
  limit: z.number().int().min(1).max(10000).default(20),
  url_filter: z.string().optional(),
  url_match_type: z.enum(["equals", "contains", "regex"]).default("contains"),
  query_filter: z.string().optional(),
});

export const TOP_QUERIES_DESCRIPTION = `Get top search queries ranked by a metric.

Use this for questions like:
- "What are our top search queries?"
- "Top queries driving traffic to /pricing"
- "What queries containing 'how to' get the most impressions?"

Returns: Ranked list of queries with clicks, impressions, CTR, and position.
Default: Top 20 queries by clicks over last 28 days.`;

export type TopQueriesInput = z.infer<typeof topQueriesInput>;

export async function topQueries(input: TopQueriesInput, user?: string) {
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

  const rows = await executeQuery({ sql, params }, { tool: "top_queries", user });
  return { rows, rowCount: rows.length, dateRange: { startDate, endDate } };
}
