import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaApiClient } from "../figma-api.js";
import type { Logger } from "../logger.js";
import { parseFigmaUrl } from "../url-parser.js";
import { compressResponse } from "../response-utils.js";
import type { FigmaNode, FigmaComponent } from "../types/figma-api.js";
import { GetComponentInput, GetComponentImageInput } from "../types/tools.js";

// ---- Helpers ----

function findNodesByName(node: FigmaNode, name: string, results: FigmaNode[] = []): FigmaNode[] {
  if (node.name.toLowerCase().includes(name.toLowerCase())) {
    results.push(node);
  }
  if (node.children) {
    for (const child of node.children) {
      findNodesByName(child, name, results);
    }
  }
  return results;
}

function buildReconstructionSpec(node: FigmaNode): Record<string, unknown> {
  const spec: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  if (node.absoluteBoundingBox) {
    spec.bounds = node.absoluteBoundingBox;
  }
  if (node.layoutMode) {
    spec.layout = {
      mode: node.layoutMode,
      primaryAxisSizing: node.primaryAxisSizingMode,
      counterAxisSizing: node.counterAxisSizingMode,
      primaryAxisAlign: node.primaryAxisAlignItems,
      counterAxisAlign: node.counterAxisAlignItems,
      padding: {
        top: node.paddingTop,
        right: node.paddingRight,
        bottom: node.paddingBottom,
        left: node.paddingLeft,
      },
      itemSpacing: node.itemSpacing,
      wrap: node.layoutWrap,
    };
  }
  if (node.fills && node.fills.length > 0) {
    spec.fills = node.fills;
  }
  if (node.strokes && node.strokes.length > 0) {
    spec.strokes = node.strokes;
    spec.strokeWeight = node.strokeWeight;
  }
  if (node.effects && node.effects.length > 0) {
    spec.effects = node.effects;
  }
  if (node.cornerRadius != null) {
    spec.cornerRadius = node.cornerRadius;
  }
  if (node.characters) {
    spec.text = {
      content: node.characters,
      style: node.style,
    };
  }
  if (node.componentPropertyDefinitions) {
    spec.componentProperties = node.componentPropertyDefinitions;
  }
  if (node.children) {
    spec.children = node.children.map(buildReconstructionSpec);
  }
  return spec;
}

// ---- Registration ----

export function registerComponentTools(
  server: McpServer,
  apiClient: FigmaApiClient,
  logger: Logger
): void {
  // ---- figma_get_component ----
  server.tool(
    "figma_get_component",
    "Get component metadata and reconstruction spec from a Figma file. Search by node ID or name. Returns layout, styles, and properties for code generation.",
    GetComponentInput,
    async (args) => {
      try {
        const { fileKey, nodeId: urlNodeId } = parseFigmaUrl(args.file_url_or_key);
        const nodeId = args.node_id ?? urlNodeId;
        logger.info({ fileKey, nodeId, name: args.name }, "Fetching component");

        if (nodeId) {
          const nodesResp = await apiClient.getFileNodes(fileKey, [nodeId], { depth: 10 });
          const nodeData = nodesResp.nodes[nodeId];
          if (!nodeData) {
            return { content: [{ type: "text", text: `Node ${nodeId} not found` }], isError: true };
          }
          const spec = buildReconstructionSpec(nodeData.document);
          return { content: [{ type: "text", text: compressResponse(spec) }] };
        }

        if (args.name) {
          const file = await apiClient.getFile(fileKey, { depth: 5 });
          const found = findNodesByName(file.document, args.name);

          // Filter to components/component sets
          const components = found.filter(
            (n) => n.type === "COMPONENT" || n.type === "COMPONENT_SET"
          );

          if (components.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No components matching "${args.name}" found. Found ${found.length} nodes with that name but none are components.`,
                },
              ],
            };
          }

          const specs = components.slice(0, 10).map(buildReconstructionSpec);
          return { content: [{ type: "text", text: compressResponse(specs) }] };
        }

        // List all components
        const file = await apiClient.getFile(fileKey, { depth: 1 });
        const componentList = Object.entries(file.components).map(([id, comp]) => ({
          id,
          name: comp.name,
          description: comp.description,
          componentSetId: comp.componentSetId,
        }));
        return {
          content: [
            {
              type: "text",
              text: compressResponse({
                components: componentList,
                componentSets: Object.entries(file.componentSets).map(([id, cs]) => ({
                  id,
                  name: cs.name,
                  description: cs.description,
                })),
                total: componentList.length,
              }),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, "figma_get_component failed");
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- figma_get_component_image ----
  server.tool(
    "figma_get_component_image",
    "Render Figma nodes as images (PNG, SVG, PDF, JPG). Returns image URLs for the specified node IDs.",
    GetComponentImageInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        const format = args.format ?? "png";
        const scale = args.scale ?? 1;
        logger.info({ fileKey, nodeIds: args.node_ids, format, scale }, "Fetching component images");

        const images = await apiClient.getImages(fileKey, args.node_ids, { format, scale });

        if (images.err) {
          return { content: [{ type: "text", text: `Figma image API error: ${images.err}` }], isError: true };
        }

        const results = Object.entries(images.images).map(([nodeId, url]) => ({
          nodeId,
          url,
          format,
          scale,
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
