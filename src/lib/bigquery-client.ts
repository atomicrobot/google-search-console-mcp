import { BigQuery } from "@google-cloud/bigquery";
import { getConfig, getFullTableId } from "@config";
import type { RequestLogger } from "@lib/logger";

let _client: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (!_client) {
    _client = new BigQuery({ projectId: getConfig().GCP_PROJECT_ID });
  }
  return _client;
}

export interface QueryOptions {
  sql: string;
  params: Record<string, unknown>;
}

export async function executeQuery(
  options: QueryOptions,
  log: RequestLogger,
): Promise<Record<string, unknown>[]> {
  const config = getConfig();
  const client = getBigQueryClient();

  log.info("Executing BigQuery query", {
    paramKeys: Object.keys(options.params),
  });
  log.debug("Query SQL", { sql: options.sql, params: options.params });

  const start = Date.now();
  const result = await client.query({
    query: options.sql,
    params: options.params,
    maximumBytesBilled: String(config.MAX_BYTES_BILLED),
    jobTimeoutMs: 30000,
  });
  const rows = result[0] as Record<string, unknown>[];

  log.info("BigQuery query complete", {
    rowCount: rows.length,
    durationMs: Date.now() - start,
  });

  return rows;
}

export function getTableRef(): string {
  return getFullTableId(getConfig());
}

/** Reset singleton for testing. */
export function _resetClient(): void {
  _client = null;
}
