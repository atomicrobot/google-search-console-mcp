import { createLogger, format, transports, type Logger } from "winston";

export const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  defaultMeta: { service: "gsc-mcp" },
  transports: [new transports.Console()],
});

export interface RequestLogger extends Logger {
  metadata: Record<string, unknown>;
}

export function createRequestLogger(meta: Record<string, unknown> = {}): RequestLogger {
  const child = logger.child(meta) as RequestLogger;
  child.metadata = meta;
  return child;
}

export function addMeta(reqLogger: RequestLogger, meta: Record<string, unknown>): RequestLogger {
  const merged = { ...reqLogger.metadata, ...meta };
  const child = logger.child(merged) as RequestLogger;
  child.metadata = merged;
  return child;
}
