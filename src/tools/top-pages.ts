import { z } from "zod";
import { executeQuery, getTableRef, ALL_METRICS_SQL, buildUrlFilter } from "@lib/bigquery";
import { getDefaultDateRange } from "@lib/date-utils";
import type { RequestLogger } from "@lib/logger";

export const topPagesInput = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  metric: z.enum(["clicks", "impressions", "ctr", "position"]).default("clicks"),
  limit: z.coerce.number().int().min(1).max(10000).default(20),
  url_filter: z.string().optional(),
  url_match_type: z.enum(["equals", "contains", "regex"]).default("contains"),
});

export const TOP_PAGES_DESCRIPTION = `Get top-performing pages ranked by a metric.

Use this for questions like:
- "What are our top pages by clicks?"
- "Which blog posts get the most impressions?"
- "Top 50 pages by CTR for /products/ URLs"

Returns: Ranked list of pages with clicks, impressions, CTR, and position.
Default: Top 20 pages by clicks over last 28 days.`;

export type TopPagesInput = z.infer<typeof topPagesInput>;

export async function topPages(input: TopPagesInput, log: RequestLogger) {
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

  const orderDirection = input.metric === "position" ? "ASC" : "DESC";

  const sql = `
    SELECT url AS page, ${ALL_METRICS_SQL}
    FROM \`${getTableRef()}\`
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY url
    ORDER BY ${input.metric} ${orderDirection}
    LIMIT ${input.limit}
  `;

  const rows = await executeQuery({ sql, params }, log);
  return { rows, rowCount: rows.length, dateRange: { startDate, endDate } };
}
