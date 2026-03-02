import { z } from "zod";
import type { RequestLogger } from "@lib/logger";

export const listSchemaInput = z.object({});

export const LIST_SCHEMA_DESCRIPTION = `Discover available dimensions, metrics, and data characteristics for Google Search Console data in BigQuery.

Call this tool first to understand what data is available before querying.

Returns:
- Available dimensions with descriptions and example values
- Available metrics with descriptions
- Notes about data freshness and history`;

export function listSchema(log: RequestLogger) {
  log.info("Listing schema");

  return {
    dimensions: [
      {
        name: "query",
        description: "Search query text the user typed into Google",
        examples: ["pricing", "how to migrate", "brand name"],
      },
      {
        name: "page",
        description: "Full URL of the page that appeared in search results",
        examples: ["https://example.com/pricing", "https://example.com/blog/post-1"],
      },
      {
        name: "country",
        description: "3-letter ISO country code",
        examples: ["USA", "GBR", "DEU", "JPN"],
      },
      {
        name: "device",
        description: "Device type",
        values: ["DESKTOP", "MOBILE", "TABLET"],
      },
      {
        name: "date",
        description: "Date of the data (YYYY-MM-DD format)",
        notes: "Use for time series analysis",
      },
    ],
    metrics: [
      { name: "clicks", description: "Number of clicks from search results to the page" },
      { name: "impressions", description: "Number of times the page appeared in search results" },
      {
        name: "ctr",
        description: "Click-through rate (clicks / impressions)",
        notes: "Returned as a decimal (e.g., 0.05 = 5%)",
      },
      {
        name: "position",
        description: "Average position in search results (1 = top)",
        notes: "Lower is better. 1.0 means always first result.",
      },
    ],
    notes: [
      "Data is typically delayed ~3 days from Google",
      "Up to ~16 months of historical data available",
      "Default date range is last 28 days when not specified",
      "Country values use 3-letter ISO codes (USA, GBR, DEU, etc.)",
      "Device values are MOBILE, DESKTOP, TABLET (uppercase)",
    ],
  };
}
