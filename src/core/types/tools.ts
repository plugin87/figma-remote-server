import { z } from "zod";

// ---- Tool input schemas (Zod raw shapes for registerTool) ----

export const FileDataInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL (e.g. https://www.figma.com/design/ABC123/...) or raw file key"),
  node_id: z
    .string()
    .optional()
    .describe("Specific node ID to fetch (e.g. '1:23'). Overrides node-id in URL if both given"),
  depth: z
    .number()
    .optional()
    .describe("Tree traversal depth. Lower values return less data. Default 2"),
};

export const FileMetadataInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
};

export const NavigateInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  node_id: z
    .string()
    .describe("Node ID to navigate to (e.g. '1:23')"),
};

export const GetVariablesInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  format: z
    .enum(["raw", "css", "scss", "tailwind", "json", "typescript"])
    .optional()
    .describe("Output format for variables. Default: raw"),
  collection_name: z
    .string()
    .optional()
    .describe("Filter by variable collection name"),
};

export const GetStylesInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  format: z
    .enum(["raw", "css", "scss", "tailwind", "json", "typescript"])
    .optional()
    .describe("Output format for styles. Default: raw"),
};

export const GetComponentInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  node_id: z
    .string()
    .optional()
    .describe("Specific component node ID"),
  name: z
    .string()
    .optional()
    .describe("Component name to search for"),
};

export const GetComponentImageInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  node_ids: z
    .array(z.string())
    .describe("Node IDs to render as images"),
  format: z
    .enum(["png", "svg", "pdf", "jpg"])
    .optional()
    .describe("Image format. Default: png"),
  scale: z
    .number()
    .optional()
    .describe("Image scale (0.01-4). Default: 1"),
};

export const CommentsInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  as_md: z
    .boolean()
    .optional()
    .describe("Return comments as markdown. Default: false"),
};

export const PostCommentInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  message: z.string().describe("Comment message text"),
  node_id: z.string().optional().describe("Node ID to attach comment to"),
  x: z.number().optional().describe("X coordinate for pinned comment"),
  y: z.number().optional().describe("Y coordinate for pinned comment"),
  parent_id: z.string().optional().describe("Parent comment ID for replies"),
};

export const DeleteCommentInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  comment_id: z.string().describe("Comment ID to delete"),
};

export const DesignSystemKitInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  format: z
    .enum(["full", "summary", "compact"])
    .optional()
    .describe("Output detail level. Default: summary"),
  code_format: z
    .enum(["css", "scss", "tailwind", "json", "typescript"])
    .optional()
    .describe("Code export format. Default: css"),
};

export const LintDesignInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  node_id: z.string().optional().describe("Specific node to lint"),
  checks: z
    .array(z.enum(["contrast", "target-size", "color-only", "focus", "heading-hierarchy", "spacing", "token-usage", "naming", "all"]))
    .optional()
    .describe("Specific checks to run. Default: all"),
};

export const DesignParityInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  node_id: z.string().describe("Node ID of the component to check"),
  code_tokens: z
    .record(z.string(), z.string())
    .optional()
    .describe("Map of token names to values from your codebase for comparison"),
};

export const ComponentDocInput = {
  file_url_or_key: z
    .string()
    .describe("Figma file URL or raw file key"),
  node_id: z.string().describe("Node ID of the component to document"),
  format: z
    .enum(["markdown", "json"])
    .optional()
    .describe("Output format. Default: markdown"),
};
