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
      "Desktop Bridge server ไม่สามารถเริ่มได้ (port 9223-9232 อาจถูกใช้งานอยู่)\n\n" +
        "วิธีแก้:\n" +
        "1. ปิด Claude Desktop ทั้งหมด (Cmd+Q) แล้วเปิดใหม่\n" +
        "2. ถ้ายังไม่ได้ ลอง: lsof -i :9223 เพื่อเช็คว่า port ถูกใช้โดยอะไร\n" +
        "3. Kill process ที่ใช้ port นั้นแล้วลองใหม่"
    );
  }

  async sendCommand(): Promise<never> {
    throw new Error(
      "Desktop Bridge server ไม่สามารถเริ่มได้ (port 9223-9232 อาจถูกใช้งานอยู่)\n\n" +
        "วิธีแก้:\n" +
        "1. ปิด Claude Desktop ทั้งหมด (Cmd+Q) แล้วเปิดใหม่\n" +
        "2. ถ้ายังไม่ได้ ลอง: lsof -i :9223 เพื่อเช็คว่า port ถูกใช้โดยอะไร\n" +
        "3. Kill process ที่ใช้ port นั้นแล้วลองใหม่"
    );
  }
}
