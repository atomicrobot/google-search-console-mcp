import express from "express";
import { loadConfig } from "@config";
import { logger, createRequestLogger } from "@lib/logger";
import { authMiddleware } from "@auth/middleware";
import { oauthRouter } from "@auth/oauth-routes";
import { createMcpServer } from "./server";
import { handleStreamableHttp, handleStreamableHttpDelete } from "@transport/streamable-http";

const config = loadConfig();
const app = express();
const mcpServer = createMcpServer();

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  req.log = createRequestLogger({
    requestId: crypto.randomUUID(),
    method: req.method,
    path: req.path,
  });
  req.log.info("Incoming request");
  next();
});

// Health check (unauthenticated)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// OAuth routes (unauthenticated)
app.use(oauthRouter);

// Authenticated MCP transport (Streamable HTTP)
app.post("/mcp", authMiddleware, (req, res) => handleStreamableHttp(req, res, mcpServer));
app.get("/mcp", authMiddleware, (req, res) => handleStreamableHttp(req, res, mcpServer));
app.delete("/mcp", authMiddleware, (req, res) => handleStreamableHttpDelete(req, res));

app.listen(config.PORT, () => {
  logger.info(`GSC MCP server listening on port ${config.PORT}`, {
    port: config.PORT,
    serverUrl: config.SERVER_URL,
  });
});
