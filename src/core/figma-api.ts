import type { LRUCache } from "./cache.js";
import type { Logger } from "./logger.js";
import type {
  FigmaCommentsResponse,
  FigmaComponentsResponse,
  FigmaFileNodesResponse,
  FigmaFileResponse,
  FigmaImagesResponse,
  FigmaLocalVariablesResponse,
  FigmaProjectFilesResponse,
  FigmaStylesResponse,
  FigmaTeamProjectsResponse,
  FigmaUserResponse,
  FigmaVersionsResponse,
} from "./types/figma-api.js";

export interface FigmaApiClientOptions {
  accessToken: string;
  apiBase: string;
  logger: Logger;
  cache: LRUCache;
  timeoutMs?: number;
}

export class FigmaApiError extends Error {
  constructor(
    public statusCode: number,
    public statusText: string,
    public body: string,
    public endpoint: string
  ) {
    super(`Figma API error ${statusCode} (${statusText}) on ${endpoint}: ${body}`);
    this.name = "FigmaApiError";
  }
}

export class FigmaApiClient {
  private accessToken: string;
  private apiBase: string;
  private logger: Logger;
  private cache: LRUCache;
  private timeoutMs: number;
  private authHeader: Record<string, string>;

  constructor(options: FigmaApiClientOptions) {
    this.accessToken = options.accessToken;
    this.apiBase = options.apiBase.replace(/\/$/, "");
    this.logger = options.logger;
    this.cache = options.cache;
    this.timeoutMs = options.timeoutMs ?? 30_000;

    // Token type detection:
    // figu_ = OAuth user token → Bearer header
    // figd_ = could be OAuth device token OR new-format PAT → try X-Figma-Token first
    // Otherwise = classic Personal Access Token → X-Figma-Token header
    if (this.accessToken.startsWith("figu_")) {
      this.authHeader = { Authorization: `Bearer ${this.accessToken}` };
    } else {
      // PAT (classic or figd_ new-format) → X-Figma-Token
      this.authHeader = { "X-Figma-Token": this.accessToken };
    }
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      cacheKey?: string;
    } = {}
  ): Promise<T> {
    const { method = "GET", body, cacheKey } = options;

    // Check cache for GET requests
    if (method === "GET" && cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) {
        this.logger.debug({ cacheKey }, "Cache hit");
        return cached as T;
      }
    }

    const url = `${this.apiBase}${endpoint}`;
    const startTime = Date.now();

    this.logger.debug({ method, url }, "Figma API request");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...this.authHeader,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const duration = Date.now() - startTime;
      this.logger.debug(
        { method, url, status: response.status, duration },
        "Figma API response"
      );

      if (!response.ok) {
        const errorBody = await response.text();

        // Rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          throw new FigmaApiError(
            429,
            `Rate limited. Retry after ${retryAfter ?? "unknown"} seconds`,
            errorBody,
            endpoint
          );
        }

        throw new FigmaApiError(
          response.status,
          response.statusText,
          errorBody,
          endpoint
        );
      }

      const data = (await response.json()) as T;

      // Cache GET responses
      if (method === "GET" && cacheKey) {
        this.cache.set(cacheKey, data);
      }

      return data;
    } catch (error) {
      if (error instanceof FigmaApiError) throw error;
      // AbortError — compatible with Node 16+ (no DOMException) and Node 18+
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Figma API request timed out after ${this.timeoutMs}ms: ${endpoint}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ---- File endpoints ----

  async getFile(
    fileKey: string,
    opts?: { depth?: number; nodeIds?: string; geometry?: string }
  ): Promise<FigmaFileResponse> {
    const params = new URLSearchParams();
    if (opts?.depth != null) params.set("depth", String(opts.depth));
    if (opts?.nodeIds) params.set("ids", opts.nodeIds);
    if (opts?.geometry) params.set("geometry", opts.geometry);
    const qs = params.toString();
    const endpoint = `/v1/files/${fileKey}${qs ? `?${qs}` : ""}`;
    return this.request<FigmaFileResponse>(endpoint, {
      cacheKey: `file:${fileKey}:${qs}`,
    });
  }

  async getFileNodes(
    fileKey: string,
    nodeIds: string[],
    opts?: { depth?: number; geometry?: string }
  ): Promise<FigmaFileNodesResponse> {
    const params = new URLSearchParams();
    params.set("ids", nodeIds.join(","));
    if (opts?.depth != null) params.set("depth", String(opts.depth));
    if (opts?.geometry) params.set("geometry", opts.geometry);
    const qs = params.toString();
    const endpoint = `/v1/files/${fileKey}/nodes?${qs}`;
    return this.request<FigmaFileNodesResponse>(endpoint, {
      cacheKey: `nodes:${fileKey}:${qs}`,
    });
  }

  // ---- User ----

  async getMe(): Promise<FigmaUserResponse> {
    return this.request<FigmaUserResponse>("/v1/me");
  }

  // ---- Images ----

  async getImages(
    fileKey: string,
    nodeIds: string[],
    opts?: { format?: string; scale?: number; svgIncludeId?: boolean }
  ): Promise<FigmaImagesResponse> {
    const params = new URLSearchParams();
    params.set("ids", nodeIds.join(","));
    if (opts?.format) params.set("format", opts.format);
    if (opts?.scale != null) params.set("scale", String(opts.scale));
    if (opts?.svgIncludeId) params.set("svg_include_id", "true");
    const endpoint = `/v1/images/${fileKey}?${params.toString()}`;
    return this.request<FigmaImagesResponse>(endpoint);
  }

  async getImageFills(fileKey: string): Promise<FigmaImagesResponse> {
    return this.request<FigmaImagesResponse>(`/v1/files/${fileKey}/images`);
  }

  // ---- Comments ----

  async getComments(fileKey: string): Promise<FigmaCommentsResponse> {
    return this.request<FigmaCommentsResponse>(`/v1/files/${fileKey}/comments`, {
      cacheKey: `comments:${fileKey}`,
    });
  }

  async postComment(
    fileKey: string,
    message: string,
    opts?: { nodeId?: string; x?: number; y?: number; parentId?: string }
  ): Promise<FigmaCommentsResponse> {
    const body: Record<string, unknown> = { message };
    if (opts?.parentId) {
      body.comment_id = opts.parentId;
    } else if (opts?.nodeId) {
      body.client_meta = { node_id: opts.nodeId, node_offset: { x: opts.x ?? 0, y: opts.y ?? 0 } };
    } else if (opts?.x != null && opts?.y != null) {
      body.client_meta = { x: opts.x, y: opts.y };
    }
    return this.request<FigmaCommentsResponse>(`/v1/files/${fileKey}/comments`, {
      method: "POST",
      body,
    });
  }

  async deleteComment(fileKey: string, commentId: string): Promise<void> {
    await this.request<void>(`/v1/files/${fileKey}/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  // ---- Versions ----

  async getFileVersions(fileKey: string): Promise<FigmaVersionsResponse> {
    return this.request<FigmaVersionsResponse>(`/v1/files/${fileKey}/versions`, {
      cacheKey: `versions:${fileKey}`,
    });
  }

  // ---- Styles (team-level) ----

  async getTeamStyles(teamId: string, pageSize = 50): Promise<FigmaStylesResponse> {
    return this.request<FigmaStylesResponse>(
      `/v1/teams/${teamId}/styles?page_size=${pageSize}`,
      { cacheKey: `teamStyles:${teamId}` }
    );
  }

  // ---- Components (team-level) ----

  async getTeamComponents(teamId: string, pageSize = 50): Promise<FigmaComponentsResponse> {
    return this.request<FigmaComponentsResponse>(
      `/v1/teams/${teamId}/components?page_size=${pageSize}`,
      { cacheKey: `teamComponents:${teamId}` }
    );
  }

  // ---- Variables (Enterprise) ----

  async getLocalVariables(fileKey: string): Promise<FigmaLocalVariablesResponse> {
    return this.request<FigmaLocalVariablesResponse>(
      `/v1/files/${fileKey}/variables/local`,
      { cacheKey: `variables:${fileKey}` }
    );
  }

  async getPublishedVariables(fileKey: string): Promise<FigmaLocalVariablesResponse> {
    return this.request<FigmaLocalVariablesResponse>(
      `/v1/files/${fileKey}/variables/published`,
      { cacheKey: `publishedVariables:${fileKey}` }
    );
  }

  // ---- Team/Project ----

  async getTeamProjects(teamId: string): Promise<FigmaTeamProjectsResponse> {
    return this.request<FigmaTeamProjectsResponse>(`/v1/teams/${teamId}/projects`, {
      cacheKey: `teamProjects:${teamId}`,
    });
  }

  async getProjectFiles(projectId: string): Promise<FigmaProjectFilesResponse> {
    return this.request<FigmaProjectFilesResponse>(`/v1/projects/${projectId}/files`, {
      cacheKey: `projectFiles:${projectId}`,
    });
  }
}
