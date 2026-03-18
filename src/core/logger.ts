import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(level: string): Logger {
  return pino({
    level,
    transport: {
      target: "pino/file",
      options: { destination: 2 }, // stderr — stdout is reserved for MCP JSON-RPC
    },
  });
}
