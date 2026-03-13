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

export const cannibalizationInput = z.object({
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
  min_pages: z.coerce
    .number()
    .int()
    .min(2)
    .default(2)
    .describe("Minimum number of pages ranking for the same query to flag as cannibalization"),
  min_impressions: z.coerce
    .number()
    .int()
    .min(0)
    .default(10)
    .describe("Minimum total impressions for a query to be included"),
  query_filter: z.string().optional().describe("Filter to queries matching this search term text"),
  query_match_type: z
    .enum(["equals", "contains", "regex"])
    .default("contains")
    .describe("How to match the query_filter: exact match, substring, or regex"),
  url_filter: z.string().optional().describe("Filter to pages matching this URL or URL pattern"),
  url_match_type: z
    .enum(["equals", "contains", "regex"])
    .default("contains")
    .describe("How to match the url_filter: exact match, substring, or regex"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(25)
    .describe("Maximum number of cannibalized queries to return"),
});

export const CANNIBALIZATION_DESCRIPTION = `Find queries where multiple pages on the site compete for the same search term (keyword cannibalization).

Use this for questions like:
- "Are any of our pages competing for the same keywords?"
- "Show cannibalization issues for queries containing 'guide'"
- "Which queries have more than 3 pages ranking?"

Returns: For each cannibalized query, shows all competing pages with their metrics.
Pages are sorted by impressions within each query group.`;

export type CannibalizationInput = z.infer<typeof cannibalizationInput>;

export async function cannibalization(input: CannibalizationInput, log: RequestLogger) {
  const defaults = getDefaultDateRange();
  const startDate = input.start_date || defaults.startDate;
  const endDate = input.end_date || defaults.endDate;

  const params: Record<string, unknown> = {
    start_date: startDate,
    end_date: endDate,
    min_pages: input.min_pages,
    min_impressions: input.min_impressions,
  };

  const extraFilters: string[] = [];
  if (input.query_filter) {
    extraFilters.push(buildQueryFilter("query_filter", input.query_match_type));
    params.query_filter = input.query_filter;
  }
  if (input.url_filter) {
    extraFilters.push(buildUrlFilter("url_filter", input.url_match_type));
    params.url_filter = input.url_filter;
  }

  const filterSQL = extraFilters.length > 0 ? `AND ${extraFilters.join(" AND ")}` : "";

  const sql = `
    WITH page_query_metrics AS (
      SELECT query, url AS page, ${ALL_METRICS_SQL}
      FROM \`${getTableRef()}\`
      WHERE data_date BETWEEN @start_date AND @end_date ${filterSQL}
      GROUP BY query, url
    ),
    cannibalized_queries AS (
      SELECT query,
        COUNT(DISTINCT page) AS page_count,
        SUM(impressions) AS total_impressions
      FROM page_query_metrics
      GROUP BY query
      HAVING COUNT(DISTINCT page) >= @min_pages AND SUM(impressions) >= @min_impressions
      ORDER BY SUM(impressions) DESC
      LIMIT ${input.limit}
    )
    SELECT
      pqm.query,
      cq.page_count,
      cq.total_impressions,
      pqm.page,
      pqm.clicks,
      pqm.impressions,
      pqm.ctr,
      pqm.position
    FROM cannibalized_queries cq
    JOIN page_query_metrics pqm ON cq.query = pqm.query
    ORDER BY cq.total_impressions DESC, cq.query, pqm.impressions DESC
  `;

  const rows = await executeQuery({ sql, params }, log);

  // Group rows by query
  const grouped: Record<
    string,
    { query: string; pageCount: number; totalImpressions: number; pages: Record<string, unknown>[] }
  > = {};

  for (const row of rows) {
    const q = row.query as string;
    if (!grouped[q]) {
      grouped[q] = {
        query: q,
        pageCount: row.page_count as number,
        totalImpressions: row.total_impressions as number,
        pages: [],
      };
    }
    grouped[q].pages.push({
      page: row.page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    });
  }

  return {
    queries: Object.values(grouped),
    queryCount: Object.keys(grouped).length,
    dateRange: { startDate, endDate },
  };
}
