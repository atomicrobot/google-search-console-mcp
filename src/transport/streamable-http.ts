import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "@lib/logger";

// In-memory because StreamableHTTPServerTransport holds open HTTP response
// streams that can't be serialized to external storage. Cloud Run session
// affinity routes the same client to the same instance. If an instance dies,
// the client reconnects and gets a new session — no user data is lost.
const transports = new Map<string, StreamableHTTPServerTransport>();

export async function handleStreamableHttp(
  req: Request,
  res: Response,
  createServer: () => McpServer,
): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId) {
    const transport = transports.get(sessionId);
    if (transport) {
      await transport.handleRequest(req, res, req.body);
      return;
    }
    // Stale session (e.g. server restarted after deploy) — tell client to re-initialize
    res.status(404).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Session not found. Please reconnect." },
      id: null,
    });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => {
      req.log.info("Streamable HTTP session initialized", { sessionId: id });
      transports.set(id, transport);
    },
  });

  transport.onclose = () => {
    const id = [...transports.entries()].find(([, t]) => t === transport)?.[0];
    if (id) {
      logger.info("Streamable HTTP session closed", { sessionId: id });
      transports.delete(id);
    }
  };

  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

export function handleStreamableHttpDelete(req: Request, res: Response): void {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    transports.get(sessionId)!.close();
    transports.delete(sessionId);
    res.status(200).end();
  } else {
    res.status(404).json({ error: "Session not found" });
  }
}
