import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DesktopBridgeServer } from "../../connectors/websocket-server.js";
import type { Logger } from "../logger.js";

export function registerConsoleTools(
  server: McpServer,
  bridge: DesktopBridgeServer,
  logger: Logger
): void {
  server.tool(
    "figma_get_console_logs",
    "Get console logs captured from the Figma plugin context. Only available in local mode with Desktop Bridge.",
    {
      since: z.number().optional().describe("Only return logs after this Unix timestamp (ms)"),
      level: z
        .enum(["log", "warn", "error", "info", "debug"])
        .optional()
        .describe("Filter by log level"),
      limit: z.number().optional().describe("Maximum number of logs to return. Default: 100"),
    },
    async (args) => {
      try {
        let logs = bridge.getConsoleLogs(args.since);

        if (args.level) {
          logs = logs.filter((l) => l.level === args.level);
        }

        const limit = args.limit ?? 100;
        if (logs.length > limit) {
          logs = logs.slice(-limit);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  logs,
                  total: logs.length,
                  bridgeConnected: bridge.isConnected,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_clear_console",
    "Clear all captured console logs. Only available in local mode.",
    {},
    async () => {
      bridge.clearConsoleLogs();
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, message: "Console logs cleared" }) }],
      };
    }
  );

  server.tool(
    "figma_watch_console",
    "Get a snapshot of recent console activity and bridge status. Use repeatedly to 'watch' console output. Only available in local mode.",
    {
      duration_ms: z.number().optional().describe("Look back this many milliseconds. Default: 5000"),
    },
    async (args) => {
      const since = Date.now() - (args.duration_ms ?? 5000);
      const logs = bridge.getConsoleLogs(since);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: bridge.isConnected ? "connected" : "disconnected",
                port: bridge.activePort,
                clients: bridge.clientCount,
                recentLogs: logs,
                logCount: logs.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
