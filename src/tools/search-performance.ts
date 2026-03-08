import { z } from "zod";
import {
  executeQuery,
  getTableRef,
  ALL_METRICS_SQL,
  dimensionToColumn,
  buildFilterClause,
  type Dimension,
  type FilterSpec,
} from "@lib/bigquery";
import { getDefaultDateRange } from "@lib/date-utils";
import type { RequestLogger } from "@lib/logger";

export const searchPerformanceInput = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dimensions: z.array(z.enum(["query", "page", "country", "device", "date"])).default([]),
  filters: z
    .array(
      z.object({
        dimension: z.enum(["query", "page", "country", "device"]),
        operator: z.enum(["equals", "contains", "regex", "not_contains", "not_equals"]),
        expression: z.string(),
      }),
    )
    .default([]),
  order_by: z.enum(["clicks", "impressions", "ctr", "position"]).default("clicks"),
  order_direction: z.enum(["asc", "desc"]).default("desc"),
  row_limit: z.coerce.number().int().min(1).max(10000).default(100),
});

export const SEARCH_PERFORMANCE_DESCRIPTION = `Query Google Search Console performance data from BigQuery. This is the most flexible tool — use it when other specialized tools don't fit.

Use this for questions like:
- "How many clicks did we get last month?"
- "Show impressions for mobile in Germany"
- "What's our average position for queries containing 'pricing'?"

Dimensions: query, page, country, device, date
Metrics returned: clicks, impressions, ctr, position
Device values: MOBILE, DESKTOP, TABLET
Country values: 3-letter ISO codes (e.g., USA, GBR, DEU)

Default date range: last 28 days. Data is delayed ~3 days from Google.`;

export type SearchPerformanceInput = z.infer<typeof searchPerformanceInput>;

export async function searchPerformance(input: SearchPerformanceInput, log: RequestLogger) {
  const defaults = getDefaultDateRange();
  const startDate = input.start_date || defaults.startDate;
  const endDate = input.end_date || defaults.endDate;

  const params: Record<string, unknown> = {
    start_date: startDate,
    end_date: endDate,
  };

  const whereClauses = ["data_date BETWEEN @start_date AND @end_date"];

  // Build filter clauses
  input.filters.forEach((filter: FilterSpec, i: number) => {
    const { clause, paramName } = buildFilterClause(filter, i);
    whereClauses.push(clause);
    params[paramName] = filter.expression;
  });

  // Build GROUP BY / SELECT dimensions
  const dimColumns = input.dimensions.map((d: Dimension) => dimensionToColumn(d));
  const dimSelect = dimColumns.length > 0 ? dimColumns.join(", ") + ", " : "";
  const groupBy = dimColumns.length > 0 ? `GROUP BY ${dimColumns.join(", ")}` : "";

  const sql = `
    SELECT ${dimSelect}${ALL_METRICS_SQL}
    FROM \`${getTableRef()}\`
    WHERE ${whereClauses.join(" AND ")}
    ${groupBy}
    ORDER BY ${input.order_by} ${input.order_direction}
    LIMIT ${input.row_limit}
  `;

  const rows = await executeQuery({ sql, params }, log);
  return { rows, rowCount: rows.length, dateRange: { startDate, endDate } };
}
