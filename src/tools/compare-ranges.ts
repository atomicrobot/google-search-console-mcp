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

export const compareRangesInput = z.object({
  period1_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period1_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period2_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period2_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
  metric: z.enum(["clicks", "impressions", "ctr", "position"]).default("clicks"),
  row_limit: z.number().int().min(1).max(10000).default(50),
});

export const COMPARE_RANGES_DESCRIPTION = `Compare two time periods side by side with absolute and percentage deltas.

Use this for questions like:
- "Compare this month vs last month"
- "How did our top queries change between Q3 and Q4?"
- "Compare clicks this week vs same week last year"

Returns: Rows with metrics for each period, absolute delta, and percentage change.
Sorted by biggest absolute change in the primary metric.`;

export type CompareRangesInput = z.infer<typeof compareRangesInput>;

export async function compareRanges(input: CompareRangesInput, user?: string) {
  const params: Record<string, unknown> = {
    p1_start: input.period1_start,
    p1_end: input.period1_end,
    p2_start: input.period2_start,
    p2_end: input.period2_end,
  };

  const filterClauses: string[] = [];
  input.filters.forEach((filter: FilterSpec, i: number) => {
    const { clause, paramName } = buildFilterClause(filter, i);
    filterClauses.push(clause);
    params[paramName] = filter.expression;
  });

  const filterSQL = filterClauses.length > 0 ? `AND ${filterClauses.join(" AND ")}` : "";

  const dimColumns = input.dimensions.map((d: Dimension) => dimensionToColumn(d));
  const dimSelect = dimColumns.length > 0 ? dimColumns.join(", ") + ", " : "";
  const groupBy = dimColumns.length > 0 ? `GROUP BY ${dimColumns.join(", ")}` : "";
  const joinOn =
    dimColumns.length > 0 ? dimColumns.map((c) => `p1.${c} = p2.${c}`).join(" AND ") : "TRUE";

  const sql = `
    WITH period1 AS (
      SELECT ${dimSelect}${ALL_METRICS_SQL}
      FROM \`${getTableRef()}\`
      WHERE data_date BETWEEN @p1_start AND @p1_end ${filterSQL}
      ${groupBy}
    ),
    period2 AS (
      SELECT ${dimSelect}${ALL_METRICS_SQL}
      FROM \`${getTableRef()}\`
      WHERE data_date BETWEEN @p2_start AND @p2_end ${filterSQL}
      ${groupBy}
    )
    SELECT
      ${dimColumns.map((c) => `COALESCE(p1.${c}, p2.${c}) AS ${c}`).join(", ")}${dimColumns.length > 0 ? "," : ""}
      p1.clicks AS p1_clicks, p1.impressions AS p1_impressions, p1.ctr AS p1_ctr, p1.position AS p1_position,
      p2.clicks AS p2_clicks, p2.impressions AS p2_impressions, p2.ctr AS p2_ctr, p2.position AS p2_position,
      IFNULL(p2.${input.metric}, 0) - IFNULL(p1.${input.metric}, 0) AS delta,
      SAFE_DIVIDE(IFNULL(p2.${input.metric}, 0) - IFNULL(p1.${input.metric}, 0), NULLIF(p1.${input.metric}, 0)) AS delta_pct
    FROM period1 p1
    FULL OUTER JOIN period2 p2 ON ${joinOn}
    ORDER BY ABS(IFNULL(p2.${input.metric}, 0) - IFNULL(p1.${input.metric}, 0)) DESC
    LIMIT ${input.row_limit}
  `;

  const rows = await executeQuery({ sql, params }, { tool: "compare_date_ranges", user });
  return {
    rows,
    rowCount: rows.length,
    period1: { start: input.period1_start, end: input.period1_end },
    period2: { start: input.period2_start, end: input.period2_end },
  };
}
