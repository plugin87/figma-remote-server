import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaApiClient } from "../figma-api.js";
import type { Logger } from "../logger.js";
import { parseFigmaUrl } from "../url-parser.js";
import { compressResponse } from "../response-utils.js";
import type { FigmaNode, FigmaColor, FigmaPaint, FigmaTypeStyle } from "../types/figma-api.js";
import { GetStylesInput } from "../types/tools.js";

// ---- Helpers ----

function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  if (color.a < 1) return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(2)})`;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

interface ExtractedStyle {
  name: string;
  type: string;
  description: string;
  properties: Record<string, unknown>;
}

function extractFillStyle(name: string, description: string, fills: FigmaPaint[]): ExtractedStyle {
  const colors = fills
    .filter((f) => f.visible !== false && f.color)
    .map((f) => ({
      type: f.type,
      color: f.color ? figmaColorToHex(f.color) : undefined,
      opacity: f.opacity,
      blendMode: f.blendMode,
    }));
  return { name, type: "FILL", description, properties: { colors } };
}

function extractTextStyle(name: string, description: string, style: FigmaTypeStyle): ExtractedStyle {
  return {
    name,
    type: "TEXT",
    description,
    properties: {
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
      lineHeight: style.lineHeightPx,
      lineHeightUnit: style.lineHeightUnit,
      letterSpacing: style.letterSpacing,
      textAlign: style.textAlignHorizontal,
      textCase: style.textCase,
      textDecoration: style.textDecoration,
      italic: style.italic,
    },
  };
}

function extractEffectStyle(name: string, description: string, effects: unknown[]): ExtractedStyle {
  return { name, type: "EFFECT", description, properties: { effects } };
}

function styleNameToToken(name: string): string {
  return name.replace(/\//g, ".").replace(/\s+/g, "-").toLowerCase();
}

// ---- Formatters ----

function formatStylesAsCss(styles: ExtractedStyle[]): string {
  const lines = [":root {"];
  for (const s of styles) {
    const token = styleNameToToken(s.name);
    if (s.type === "FILL") {
      const colors = s.properties.colors as { color?: string }[];
      if (colors?.[0]?.color) {
        lines.push(`  --${token}: ${colors[0].color};`);
      }
    } else if (s.type === "TEXT") {
      const p = s.properties;
      if (p.fontSize) lines.push(`  --${token}-size: ${p.fontSize}px;`);
      if (p.fontWeight) lines.push(`  --${token}-weight: ${p.fontWeight};`);
      if (p.lineHeight) lines.push(`  --${token}-line-height: ${p.lineHeight}px;`);
      if (p.fontFamily) lines.push(`  --${token}-family: "${p.fontFamily}";`);
      if (p.letterSpacing) lines.push(`  --${token}-letter-spacing: ${p.letterSpacing}px;`);
    }
  }
  lines.push("}");
  return lines.join("\n");
}

function formatStylesAsScss(styles: ExtractedStyle[]): string {
  const lines: string[] = [];
  for (const s of styles) {
    const token = styleNameToToken(s.name);
    if (s.type === "FILL") {
      const colors = s.properties.colors as { color?: string }[];
      if (colors?.[0]?.color) {
        lines.push(`$${token}: ${colors[0].color};`);
      }
    } else if (s.type === "TEXT") {
      const p = s.properties;
      lines.push(`$${token}: (`);
      if (p.fontSize) lines.push(`  font-size: ${p.fontSize}px,`);
      if (p.fontWeight) lines.push(`  font-weight: ${p.fontWeight},`);
      if (p.lineHeight) lines.push(`  line-height: ${p.lineHeight}px,`);
      if (p.fontFamily) lines.push(`  font-family: "${p.fontFamily}",`);
      lines.push(`);`);
    }
  }
  return lines.join("\n");
}

function formatStyles(styles: ExtractedStyle[], format: string): string {
  switch (format) {
    case "css":
      return formatStylesAsCss(styles);
    case "scss":
      return formatStylesAsScss(styles);
    case "json":
      return JSON.stringify(styles, null, 2);
    default:
      return JSON.stringify(styles, null, 2);
  }
}

// ---- Walk nodes to find styles ----

function collectStylesFromTree(
  node: FigmaNode,
  styleMap: Record<string, { name: string; description: string; styleType: string }>,
  collected: Map<string, ExtractedStyle>
): void {
  if (node.styles) {
    for (const [role, styleId] of Object.entries(node.styles)) {
      if (collected.has(styleId)) continue;
      const meta = styleMap[styleId];
      if (!meta) continue;

      if (meta.styleType === "FILL" && node.fills) {
        collected.set(styleId, extractFillStyle(meta.name, meta.description, node.fills));
      } else if (meta.styleType === "TEXT" && node.style) {
        collected.set(styleId, extractTextStyle(meta.name, meta.description, node.style));
      } else if (meta.styleType === "EFFECT" && node.effects) {
        collected.set(styleId, extractEffectStyle(meta.name, meta.description, node.effects));
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      collectStylesFromTree(child, styleMap, collected);
    }
  }
}

// ---- Registration ----

export function registerStyleTools(
  server: McpServer,
  apiClient: FigmaApiClient,
  logger: Logger
): void {
  server.tool(
    "figma_get_styles",
    "Extract all styles (colors, text, effects, grids) from a Figma file with enriched properties and multi-format code export (CSS, SCSS, Tailwind, JSON, TypeScript).",
    GetStylesInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        const format = args.format ?? "raw";
        logger.info({ fileKey, format }, "Fetching styles");

        // Get file with enough depth to find style references
        const file = await apiClient.getFile(fileKey, { depth: 3 });

        const styleMap = file.styles;
        const collected = new Map<string, ExtractedStyle>();

        // Walk tree to enrich styles with actual values
        collectStylesFromTree(file.document, styleMap, collected);

        // Add any styles from the map that weren't found in the tree
        for (const [id, meta] of Object.entries(styleMap)) {
          if (!collected.has(id)) {
            collected.set(id, {
              name: meta.name,
              type: meta.styleType,
              description: meta.description,
              properties: {},
            });
          }
        }

        const styles = Array.from(collected.values()).sort((a, b) =>
          a.type === b.type ? a.name.localeCompare(b.name) : a.type.localeCompare(b.type)
        );

        const output =
          format === "raw"
            ? compressResponse({
                styles,
                summary: {
                  total: styles.length,
                  byType: styles.reduce(
                    (acc, s) => {
                      acc[s.type] = (acc[s.type] ?? 0) + 1;
                      return acc;
                    },
                    {} as Record<string, number>
                  ),
                },
              })
            : formatStyles(styles, format);

        return { content: [{ type: "text", text: output }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, "figma_get_styles failed");
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
