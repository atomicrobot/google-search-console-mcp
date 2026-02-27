import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "@lib/logger";
import { getConfig } from "@config";

import { listSchemaInput, listSchema, LIST_SCHEMA_DESCRIPTION } from "@tools/list-schema";
import {
  searchPerformanceInput,
  searchPerformance,
  SEARCH_PERFORMANCE_DESCRIPTION,
} from "@tools/search-performance";
import { topPagesInput, topPages, TOP_PAGES_DESCRIPTION } from "@tools/top-pages";
import { topQueriesInput, topQueries, TOP_QUERIES_DESCRIPTION } from "@tools/top-queries";
import {
  compareRangesInput,
  compareRanges,
  COMPARE_RANGES_DESCRIPTION,
} from "@tools/compare-ranges";
import {
  pagePerformanceInput,
  pagePerformance,
  PAGE_PERFORMANCE_DESCRIPTION,
} from "@tools/page-performance";
import {
  trendingQueriesInput,
  trendingQueries,
  TRENDING_QUERIES_DESCRIPTION,
} from "@tools/trending-queries";
import {
  cannibalizationInput,
  cannibalization,
  CANNIBALIZATION_DESCRIPTION,
} from "@tools/cannibalization";

function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(toolName: string, err: unknown): CallToolResult {
  logger.error(`${toolName} error`, { error: err });
  return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
}

const TOOL_NAMES = [
  "list_dimensions_metrics",
  "search_performance",
  "top_pages",
  "top_queries",
  "compare_date_ranges",
  "page_performance",
  "trending_queries",
  "cannibalization_check",
] as const;

function buildInstructions(): string | undefined {
  const { DATA_AVAILABLE_FROM } = getConfig();
  if (!DATA_AVAILABLE_FROM) return undefined;

  return [
    `This server provides Google Search Console data exported to BigQuery.`,
    `IMPORTANT: Data is only available from ${DATA_AVAILABLE_FROM} onward.`,
    `There is NO data before ${DATA_AVAILABLE_FROM}. If a query returns fewer results than expected for a date range,`,
    `it is likely because the date range extends before the data availability cutoff, not because there is limited data.`,
    `Always constrain date ranges to ${DATA_AVAILABLE_FROM} or later.`,
  ].join(" ");
}

export function createMcpServer(): McpServer {
  const instructions = buildInstructions();

  const server = new McpServer(
    { name: "gsc-bigquery", version: "1.0.0" },
    instructions ? { instructions } : {},
  );

  server.registerTool(
    "list_dimensions_metrics",
    { description: LIST_SCHEMA_DESCRIPTION, inputSchema: listSchemaInput.shape },
    () => jsonResult(listSchema()),
  );

  server.registerTool(
    "search_performance",
    { description: SEARCH_PERFORMANCE_DESCRIPTION, inputSchema: searchPerformanceInput.shape },
    async (params, extra) => {
      try {
        return jsonResult(await searchPerformance(params, extra.authInfo?.extra?.email as string));
      } catch (err) {
        return errorResult("search_performance", err);
      }
    },
  );

  server.registerTool(
    "top_pages",
    { description: TOP_PAGES_DESCRIPTION, inputSchema: topPagesInput.shape },
    async (params, extra) => {
      try {
        return jsonResult(await topPages(params, extra.authInfo?.extra?.email as string));
      } catch (err) {
        return errorResult("top_pages", err);
      }
    },
  );

  server.registerTool(
    "top_queries",
    { description: TOP_QUERIES_DESCRIPTION, inputSchema: topQueriesInput.shape },
    async (params, extra) => {
      try {
        return jsonResult(await topQueries(params, extra.authInfo?.extra?.email as string));
      } catch (err) {
        return errorResult("top_queries", err);
      }
    },
  );

  server.registerTool(
    "compare_date_ranges",
    { description: COMPARE_RANGES_DESCRIPTION, inputSchema: compareRangesInput.shape },
    async (params, extra) => {
      try {
        return jsonResult(await compareRanges(params, extra.authInfo?.extra?.email as string));
      } catch (err) {
        return errorResult("compare_date_ranges", err);
      }
    },
  );

  server.registerTool(
    "page_performance",
    { description: PAGE_PERFORMANCE_DESCRIPTION, inputSchema: pagePerformanceInput.shape },
    async (params, extra) => {
      try {
        return jsonResult(await pagePerformance(params, extra.authInfo?.extra?.email as string));
      } catch (err) {
        return errorResult("page_performance", err);
      }
    },
  );

  server.registerTool(
    "trending_queries",
    { description: TRENDING_QUERIES_DESCRIPTION, inputSchema: trendingQueriesInput.shape },
    async (params, extra) => {
      try {
        return jsonResult(await trendingQueries(params, extra.authInfo?.extra?.email as string));
      } catch (err) {
        return errorResult("trending_queries", err);
      }
    },
  );

  server.registerTool(
    "cannibalization_check",
    { description: CANNIBALIZATION_DESCRIPTION, inputSchema: cannibalizationInput.shape },
    async (params, extra) => {
      try {
        return jsonResult(await cannibalization(params, extra.authInfo?.extra?.email as string));
      } catch (err) {
        return errorResult("cannibalization_check", err);
      }
    },
  );

  logger.info(`MCP server created with ${TOOL_NAMES.length} tools registered`);
  return server;
}
