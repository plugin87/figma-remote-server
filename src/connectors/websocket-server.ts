import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { Logger } from "../core/logger.js";

export interface PluginCommand {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface PluginResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface DesktopBridgeEvents {
  onConnect: (clientId: string) => void;
  onDisconnect: (clientId: string) => void;
  onConsoleLog: (log: { level: string; message: string; timestamp: number }) => void;
}

/**
 * HTTP-based Desktop Bridge server.
 * Figma plugin sandbox blocks WebSocket, so we use HTTP polling instead.
 *
 * Endpoints:
 *   GET  /health   — health check (plugin uses this to find the server)
 *   GET  /poll     — plugin polls for pending commands
 *   POST /response — plugin sends command responses
 *   POST /console  — plugin sends console logs
 */
export class DesktopBridgeServer {
  private server: ReturnType<typeof createServer> | null = null;
  private pendingCommands: PluginCommand[] = [];
  private commandCallbacks = new Map<string, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private consoleLogs: { level: string; message: string; timestamp: number }[] = [];
  private consoleWatchers: ((log: { level: string; message: string; timestamp: number }) => void)[] = [];
  private logger: Logger;
  private events?: DesktopBridgeEvents;
  private commandTimeout: number;
  private port: number | null = null;
  private lastPollTime = 0;
  private connected = false;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(logger: Logger, events?: DesktopBridgeEvents, commandTimeout = 15_000) {
    this.logger = logger;
    this.events = events;
    this.commandTimeout = commandTimeout;
  }

  get activePort(): number | null {
    return this.port;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get clientCount(): number {
    return this.connected ? 1 : 0;
  }

  async start(portStart: number, portEnd: number): Promise<number> {
    for (let port = portStart; port <= portEnd; port++) {
      try {
        await this.tryListen(port);
        this.port = port;
        this.logger.info({ port }, "Desktop Bridge HTTP server started");
        return port;
      } catch {
        continue;
      }
    }
    throw new Error(`No available port in range ${portStart}-${portEnd}`);
  }

  private tryListen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => this.handleRequest(req, res));
      server.on("error", reject);
      server.listen(port, () => {
        this.server = server;
        resolve();
      });
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // CORS headers for Figma plugin iframe
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      this.markConnected();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", port: this.port }));
      return;
    }

    if (req.method === "GET" && req.url === "/poll") {
      this.markConnected();
      const commands = this.pendingCommands.splice(0);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(commands));
      return;
    }

    if (req.method === "POST" && req.url === "/response") {
      this.readBody(req, (body) => {
        try {
          const response = JSON.parse(body) as PluginResponse;
          const pending = this.commandCallbacks.get(response.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.commandCallbacks.delete(response.id);
            if (response.success) {
              pending.resolve(response.result);
            } else {
              pending.reject(new Error(response.error ?? "Command failed"));
            }
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400);
          res.end("Invalid JSON");
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/console") {
      this.readBody(req, (body) => {
        try {
          const msg = JSON.parse(body);
          const log = {
            level: msg.level ?? "log",
            message: msg.message ?? "",
            timestamp: Date.now(),
          };
          this.consoleLogs.push(log);
          if (this.consoleLogs.length > 1000) {
            this.consoleLogs = this.consoleLogs.slice(-500);
          }
          this.events?.onConsoleLog(log);
          for (const watcher of this.consoleWatchers) {
            watcher(log);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400);
          res.end("Invalid JSON");
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  }

  private readBody(req: IncomingMessage, callback: (body: string) => void): void {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => callback(body));
  }

  private markConnected(): void {
    if (!this.connected) {
      this.connected = true;
      this.events?.onConnect("http-plugin");
      this.logger.info("Figma plugin connected via HTTP polling");
    }
    this.lastPollTime = Date.now();

    // Reset disconnect timer
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = setTimeout(() => {
      if (Date.now() - this.lastPollTime > 10_000) {
        this.connected = false;
        this.events?.onDisconnect("http-plugin");
        this.logger.info("Figma plugin disconnected (no poll for 10s)");
      }
    }, 10_000);
  }

  async sendCommand(command: PluginCommand): Promise<unknown> {
    if (!this.connected) {
      throw new Error(
        "No Figma Desktop Bridge plugin connected. " +
          "Open Figma Desktop → Plugins → Development → Design Lazyyy Desktop Bridge"
      );
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.commandCallbacks.delete(command.id);
        reject(new Error(`Command ${command.type} timed out after ${this.commandTimeout}ms`));
      }, this.commandTimeout);

      this.commandCallbacks.set(command.id, { resolve, reject, timeout });
      this.pendingCommands.push(command);
    });
  }

  getConsoleLogs(since?: number): { level: string; message: string; timestamp: number }[] {
    if (since) return this.consoleLogs.filter((l) => l.timestamp > since);
    return [...this.consoleLogs];
  }

  clearConsoleLogs(): void {
    this.consoleLogs = [];
  }

  addConsoleWatcher(callback: (log: { level: string; message: string; timestamp: number }) => void): () => void {
    this.consoleWatchers.push(callback);
    return () => {
      this.consoleWatchers = this.consoleWatchers.filter((w) => w !== callback);
    };
  }

  async stop(): Promise<void> {
    for (const [, pending] of this.commandCallbacks) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Server shutting down"));
    }
    this.commandCallbacks.clear();

    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    this.port = null;
    this.logger.info("Desktop Bridge server stopped");
  }
}
