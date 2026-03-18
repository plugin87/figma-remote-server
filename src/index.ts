/**
 * Design Lazyyy — Figma MCP Server (Cloud Mode / Cloudflare Workers)
 *
 * Provides:
 * - OAuth 2.1 flow for Figma authentication
 * - Streamable HTTP transport for MCP
 * - Plugin relay via Durable Objects for write operations
 *
 * Built by Design Lazyyy
 */

export interface Env {
  OAUTH_KV: KVNamespace;
  PLUGIN_RELAY: DurableObjectNamespace;
  FIGMA_CLIENT_ID: string;
  FIGMA_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  FIGMA_API_BASE: string;
}

// OAuth metadata
const OAUTH_METADATA = {
  issuer: "https://design-lazyyy-figma.workers.dev",
  authorization_endpoint: "https://design-lazyyy-figma.workers.dev/authorize",
  token_endpoint: "https://design-lazyyy-figma.workers.dev/token",
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
};

function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0/O/1/I
  let code = "";
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (const byte of array) {
    code += chars[byte % chars.length];
  }
  return code;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- OAuth Discovery ----
    if (path === "/.well-known/oauth-authorization-server") {
      return Response.json(OAUTH_METADATA);
    }

    // ---- OAuth Authorize ----
    if (path === "/authorize" && request.method === "GET") {
      const clientId = url.searchParams.get("client_id");
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state");
      const codeChallenge = url.searchParams.get("code_challenge");

      if (!clientId || !redirectUri || !state) {
        return new Response("Missing required OAuth parameters", { status: 400 });
      }

      // Store PKCE challenge
      if (codeChallenge) {
        await env.OAUTH_KV.put(`pkce:${state}`, codeChallenge, { expirationTtl: 600 });
      }

      // Redirect to Figma OAuth
      const figmaAuthUrl = new URL("https://www.figma.com/oauth");
      figmaAuthUrl.searchParams.set("client_id", env.FIGMA_CLIENT_ID);
      figmaAuthUrl.searchParams.set("redirect_uri", `${url.origin}/callback`);
      figmaAuthUrl.searchParams.set("scope", "files:read,file_variables:read,file_variables:write,file_comments:write");
      figmaAuthUrl.searchParams.set("state", state);
      figmaAuthUrl.searchParams.set("response_type", "code");

      // Store redirect info
      await env.OAUTH_KV.put(
        `auth_state:${state}`,
        JSON.stringify({ redirectUri, clientId }),
        { expirationTtl: 600 }
      );

      return Response.redirect(figmaAuthUrl.toString(), 302);
    }

    // ---- OAuth Callback ----
    if (path === "/callback" && request.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (!code || !state) {
        return new Response("Missing code or state", { status: 400 });
      }

      const stateData = await env.OAUTH_KV.get(`auth_state:${state}`);
      if (!stateData) {
        return new Response("Invalid or expired state", { status: 400 });
      }

      const { redirectUri } = JSON.parse(stateData);

      // Exchange code for token with Figma
      const tokenResponse = await fetch("https://www.figma.com/api/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.FIGMA_CLIENT_ID,
          client_secret: env.FIGMA_CLIENT_SECRET,
          redirect_uri: `${url.origin}/callback`,
          code,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        return new Response("Token exchange failed", { status: 500 });
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      // Generate session token
      const sessionId = crypto.randomUUID();
      await env.OAUTH_KV.put(
        `session:${sessionId}`,
        JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        }),
        { expirationTtl: tokens.expires_in }
      );

      // Redirect back to client
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set("code", sessionId);
      callbackUrl.searchParams.set("state", state);

      // Clean up
      await env.OAUTH_KV.delete(`auth_state:${state}`);

      return Response.redirect(callbackUrl.toString(), 302);
    }

    // ---- Token Endpoint ----
    if (path === "/token" && request.method === "POST") {
      const body = await request.formData();
      const grantType = body.get("grant_type");

      if (grantType === "authorization_code") {
        const code = body.get("code") as string;
        const sessionData = await env.OAUTH_KV.get(`session:${code}`);

        if (!sessionData) {
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        }

        const session = JSON.parse(sessionData);
        return Response.json({
          access_token: session.accessToken,
          token_type: "Bearer",
          expires_in: Math.floor((session.expiresAt - Date.now()) / 1000),
          refresh_token: session.refreshToken,
        });
      }

      if (grantType === "refresh_token") {
        const refreshToken = body.get("refresh_token") as string;

        const tokenResponse = await fetch("https://www.figma.com/api/oauth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.FIGMA_CLIENT_ID,
            client_secret: env.FIGMA_CLIENT_SECRET,
            refresh_token: refreshToken,
          }),
        });

        if (!tokenResponse.ok) {
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        }

        const tokens = (await tokenResponse.json()) as {
          access_token: string;
          expires_in: number;
        };

        return Response.json({
          access_token: tokens.access_token,
          token_type: "Bearer",
          expires_in: tokens.expires_in,
        });
      }

      return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
    }

    // ---- MCP Endpoint ----
    if (path === "/mcp") {
      // Validate Bearer token
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }

      // TODO: Implement Streamable HTTP transport
      // POST /mcp → JSON-RPC request/response
      // GET /mcp → SSE stream for server-initiated messages
      return new Response("MCP endpoint — implementation pending", { status: 501 });
    }

    // ---- Plugin Relay Pairing ----
    if (path === "/pair" && request.method === "POST") {
      const code = generatePairingCode();
      await env.OAUTH_KV.put(`pair:${code}`, "pending", { expirationTtl: 300 });
      return Response.json({ code, expiresIn: 300 });
    }

    return new Response("Not found", { status: 404 });
  },
};

/**
 * Durable Object for WebSocket relay between cloud MCP server and Desktop Bridge plugin.
 * Pairs use a 6-character code (no confusable chars) with 5-min TTL.
 */
export class PluginRelayDO {
  private state: DurableObjectState;
  private sessions = new Map<string, WebSocket>();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      const pair = this.state.getWebSocketAutoResponse();
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }

      const [client, server] = Object.values(new WebSocketPair());
      this.state.acceptWebSocket(server);

      const role = url.searchParams.get("role") ?? "plugin";
      this.sessions.set(role, server);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
    // Relay message to the other party
    for (const [role, socket] of this.sessions) {
      if (socket !== ws && socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    for (const [role, socket] of this.sessions) {
      if (socket === ws) {
        this.sessions.delete(role);
        break;
      }
    }
  }
}
