export interface ServerConfig {
  figmaAccessToken: string;
  figmaApiBase: string;
  cacheMaxSize: number;
  cacheTtlMs: number;
  logLevel: string;
  /** Port range start for WebSocket Desktop Bridge */
  wsPortStart: number;
  /** Port range end for WebSocket Desktop Bridge */
  wsPortEnd: number;
}
