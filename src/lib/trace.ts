import { getConfig } from "@config";

interface TraceContext {
  requestId: string;
  "logging.googleapis.com/trace"?: string;
  "logging.googleapis.com/spanId"?: string;
}

export function parseTraceContext(header: string | undefined): TraceContext {
  if (header) {
    const match = header.match(/^([a-f0-9]{32})\/?([a-f0-9]*)?/);
    if (match) {
      const traceId = match[1];
      const spanId = match[2] || undefined;
      const { GCP_PROJECT_ID } = getConfig();
      const result: TraceContext = {
        requestId: traceId,
        "logging.googleapis.com/trace": `projects/${GCP_PROJECT_ID}/traces/${traceId}`,
      };
      if (spanId) {
        result["logging.googleapis.com/spanId"] = spanId;
      }
      return result;
    }
  }
  return { requestId: crypto.randomUUID() };
}
