import type { DesktopBridgeServer, PluginCommand } from "./websocket-server.js";

/**
 * Abstraction for executing commands in Figma's plugin context.
 * Write operations require the Desktop Bridge plugin to be connected.
 */
export interface FigmaConnector {
  readonly isConnected: boolean;
  executeInPluginContext(code: string, timeout?: number): Promise<unknown>;
  sendCommand(command: PluginCommand): Promise<unknown>;
}

/**
 * Connector using HTTP Desktop Bridge for local mode.
 */
export class WebSocketDesktopConnector implements FigmaConnector {
  constructor(private bridge: DesktopBridgeServer) {}

  get isConnected(): boolean {
    return this.bridge.isConnected;
  }

  async executeInPluginContext(code: string, timeout = 5000): Promise<unknown> {
    return this.bridge.sendCommand({
      id: crypto.randomUUID(),
      type: "execute",
      payload: { code, timeout },
    });
  }

  async sendCommand(command: PluginCommand): Promise<unknown> {
    return this.bridge.sendCommand(command);
  }
}

/**
 * Fallback connector that returns helpful errors for write operations.
 */
export class RestOnlyConnector implements FigmaConnector {
  get isConnected(): boolean {
    return false;
  }

  async executeInPluginContext(): Promise<never> {
    throw new Error(
      "This operation requires the Figma Desktop Bridge plugin. " +
        "Write operations cannot be performed via the REST API alone. " +
        "Install the figma-desktop-bridge plugin in Figma Desktop to enable write operations."
    );
  }

  async sendCommand(): Promise<never> {
    throw new Error(
      "No Desktop Bridge connected. Write operations require the Figma Desktop Bridge plugin."
    );
  }
}
