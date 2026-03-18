export interface CompressionThresholds {
  level1: number; // bytes — start removing verbose properties
  level2: number; // bytes — remove style properties
  level3: number; // bytes — skeleton only
}

const DEFAULT_THRESHOLDS: CompressionThresholds = {
  level1: 100_000,
  level2: 200_000,
  level3: 500_000,
};

const LEVEL1_STRIP = new Set([
  "absoluteBoundingBox",
  "absoluteRenderBounds",
  "constraints",
  "effects",
  "strokes",
  "strokeWeight",
  "strokeAlign",
  "relativeTransform",
  "size",
  "exportSettings",
  "interactions",
  "rectangleCornerRadii",
  "characterStyleOverrides",
  "styleOverrideTable",
]);

const LEVEL2_STRIP = new Set([
  ...LEVEL1_STRIP,
  "fills",
  "backgroundColor",
  "blendMode",
  "opacity",
  "cornerRadius",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "primaryAxisSizingMode",
  "counterAxisSizingMode",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "layoutWrap",
  "componentPropertyDefinitions",
  "componentProperties",
]);

const LEVEL3_KEEP = new Set([
  "id",
  "name",
  "type",
  "children",
  "characters",
  "componentId",
  "componentSetId",
  "visible",
  "layoutMode",
  "itemSpacing",
  "styles",
]);

function stripNode(node: Record<string, unknown>, level: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    if (level >= 3) {
      if (!LEVEL3_KEEP.has(key)) continue;
    } else if (level >= 2) {
      if (LEVEL2_STRIP.has(key)) continue;
    } else if (level >= 1) {
      if (LEVEL1_STRIP.has(key)) continue;
    }

    if (key === "children" && Array.isArray(value)) {
      result[key] = value.map((child) =>
        typeof child === "object" && child !== null
          ? stripNode(child as Record<string, unknown>, level)
          : child
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

function stripDeep(data: unknown, level: number): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => stripDeep(item, level));
  }
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    // If it looks like a Figma node (has id + name + type), strip it
    if ("id" in obj && "name" in obj && "type" in obj) {
      return stripNode(obj, level);
    }
    // Recurse into nested objects (e.g. document, nodes map)
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = stripDeep(value, level);
    }
    return result;
  }
  return data;
}

/**
 * Serialize data to JSON with adaptive compression.
 * Progressively strips Figma node properties at size thresholds
 * to prevent LLM context overflow.
 */
export function compressResponse(
  data: unknown,
  thresholds: CompressionThresholds = DEFAULT_THRESHOLDS
): string {
  const full = JSON.stringify(data, null, 2);
  const size = Buffer.byteLength(full, "utf-8");

  if (size <= thresholds.level1) {
    return full;
  }

  // Determine compression level
  let level: number;
  if (size <= thresholds.level2) {
    level = 1;
  } else if (size <= thresholds.level3) {
    level = 2;
  } else {
    level = 3;
  }

  const compressed = stripDeep(data, level);
  let result = JSON.stringify(compressed, null, 2);
  const prefix = `[Compressed: level ${level} — verbose properties removed to fit context. Original size: ${(size / 1024).toFixed(1)}KB]\n\n`;
  result = prefix + result;

  // Hard cap at 900KB to stay under MCP 1MB tool result limit
  const MAX_BYTES = 900_000;
  if (Buffer.byteLength(result, "utf-8") > MAX_BYTES) {
    result = result.slice(0, MAX_BYTES) + "\n\n[Truncated to fit 1MB limit]";
  }

  return result;
}

/**
 * Truncate a string to maxLength, appending a truncation notice if needed.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + `\n\n[Truncated: ${text.length - maxLength} characters omitted]`;
}
