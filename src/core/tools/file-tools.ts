import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaApiClient } from "../figma-api.js";
import type { Logger } from "../logger.js";
import { parseFigmaUrl } from "../url-parser.js";
import { compressResponse } from "../response-utils.js";
import { FileDataInput, FileMetadataInput, NavigateInput } from "../types/tools.js";

export function registerFileTools(
  server: McpServer,
  apiClient: FigmaApiClient,
  logger: Logger
): void {
  // ---- figma_get_file_data ----
  server.tool(
    "figma_get_file_data",
    "Retrieves file data from Figma including document structure, components, and styles. Accepts a Figma file URL or file key, with optional node ID and depth parameters.",
    FileDataInput,
    async (args) => {
      try {
        const { fileKey, nodeId: urlNodeId } = parseFigmaUrl(args.file_url_or_key);
        const nodeId = args.node_id ?? urlNodeId;
        const depth = args.depth ?? 2;

        let data: unknown;

        if (nodeId) {
          logger.info({ fileKey, nodeId, depth }, "Fetching Figma file nodes");
          data = await apiClient.getFileNodes(fileKey, [nodeId], { depth });
        } else {
          logger.info({ fileKey, depth }, "Fetching Figma file");
          data = await apiClient.getFile(fileKey, { depth });
        }

        const text = compressResponse(data);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, "figma_get_file_data failed");
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- figma_get_status ----
  server.tool(
    "figma_get_status",
    "Check connection status by fetching the authenticated user's Figma profile.",
    {},
    async () => {
      try {
        const user = await apiClient.getMe();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "connected",
                  user: { id: user.id, handle: user.handle, email: user.email },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Connection failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ---- figma_get_file_metadata ----
  server.tool(
    "figma_get_file_metadata",
    "Get metadata about a Figma file without fetching the full document tree. Returns name, last modified, version, components, styles, and branches.",
    FileMetadataInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        logger.info({ fileKey }, "Fetching file metadata");
        const file = await apiClient.getFile(fileKey, { depth: 1 });
        const meta = {
          name: file.name,
          lastModified: file.lastModified,
          version: file.version,
          editorType: file.editorType,
          role: file.role,
          thumbnailUrl: file.thumbnailUrl,
          schemaVersion: file.schemaVersion,
          mainFileKey: file.mainFileKey,
          componentCount: Object.keys(file.components).length,
          componentSetCount: Object.keys(file.componentSets).length,
          styleCount: Object.keys(file.styles).length,
          branches: file.branches,
        };
        return { content: [{ type: "text", text: JSON.stringify(meta, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- figma_navigate ----
  server.tool(
    "figma_navigate",
    "Generate a direct URL to a specific node in a Figma file for quick navigation.",
    NavigateInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        const nodeParam = args.node_id.replace(/:/g, "-");
        const url = `https://www.figma.com/design/${fileKey}/?node-id=${nodeParam}`;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ url, fileKey, nodeId: args.node_id }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- figma_get_file_versions ----
  server.tool(
    "figma_get_file_versions",
    "Get version history of a Figma file.",
    FileMetadataInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        logger.info({ fileKey }, "Fetching file versions");
        const versions = await apiClient.getFileVersions(fileKey);
        return {
          content: [{ type: "text", text: compressResponse(versions) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
