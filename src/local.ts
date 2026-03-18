#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./core/config.js";
import { createLogger } from "./core/logger.js";
import { FigmaApiClient } from "./core/figma-api.js";
import { LRUCache } from "./core/cache.js";
import { DesktopBridgeServer } from "./connectors/websocket-server.js";
import { WebSocketDesktopConnector, RestOnlyConnector } from "./connectors/figma-connector.js";
import { registerAllTools } from "./core/tools/index.js";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info({ version: "1.0.0" }, "Starting Design Lazyyy Figma MCP server");

  // Core services
  const cache = new LRUCache(config.cacheMaxSize, config.cacheTtlMs);
  const apiClient = new FigmaApiClient({
    accessToken: config.figmaAccessToken,
    apiBase: config.figmaApiBase,
    logger,
    cache,
  });

  // Desktop Bridge WebSocket server
  let bridge: DesktopBridgeServer | undefined;
  let connector;

  try {
    bridge = new DesktopBridgeServer(logger, {
      onConnect: (clientId) => logger.info({ clientId }, "Figma Desktop Bridge plugin connected"),
      onDisconnect: (clientId) => logger.info({ clientId }, "Figma Desktop Bridge plugin disconnected"),
      onConsoleLog: (log) => logger.debug({ log }, "Figma console log"),
    });

    const port = await bridge.start(config.wsPortStart, config.wsPortEnd);
    connector = new WebSocketDesktopConnector(bridge);
    logger.info({ port }, "Desktop Bridge WebSocket server listening");
  } catch (err) {
    logger.warn({ err }, "Could not start Desktop Bridge — write operations will be unavailable");
    connector = new RestOnlyConnector();
  }

  // MCP Server
  const server = new McpServer(
    {
      name: "design-lazyyy-figma",
      version: "1.0.0",
    },
    {
      capabilities: {
        logging: {},
      },
    }
  );

  // Register all tools
  registerAllTools({
    server,
    apiClient,
    logger,
    connector,
    bridge,
  });

  // Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("Design Lazyyy Figma MCP server ready on stdio");

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down...");
    if (bridge) await bridge.stop();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // Must write to stderr — stdout is for MCP JSON-RPC
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
