import type { FigmaNode, FigmaColor } from "../types/figma-api.js";
import { figmaColorToHex } from "../enrichment/style-resolver.js";

export interface ConsistencyScore {
  score: number; // 0-10
  tokenUsageRate: number;
  colorConsistency: number;
  typographyConsistency: number;
  spacingConsistency: number;
  findings: string[];
}

interface ColorUsage {
  hex: string;
  count: number;
  hasStyle: boolean;
}

interface TypographyUsage {
  key: string;
  count: number;
  hasStyle: boolean;
}

function collectUsageData(node: FigmaNode, data: {
  colors: Map<string, ColorUsage>;
  typography: Map<string, TypographyUsage>;
  spacings: number[];
  totalNodes: number;
  styledNodes: number;
}): void {
  data.totalNodes++;

  const hasStyle = node.styles && Object.keys(node.styles).length > 0;
  if (hasStyle) data.styledNodes++;

  // Collect colors
  if (node.fills) {
    for (const fill of node.fills) {
      if (fill.visible !== false && fill.type === "SOLID" && fill.color) {
        const hex = figmaColorToHex(fill.color);
        const existing = data.colors.get(hex);
        if (existing) {
          existing.count++;
          if (hasStyle) existing.hasStyle = true;
        } else {
          data.colors.set(hex, { hex, count: 1, hasStyle: !!hasStyle });
        }
      }
    }
  }

  // Collect typography
  if (node.type === "TEXT" && node.style) {
    const key = `${node.style.fontFamily}/${node.style.fontSize}/${node.style.fontWeight}`;
    const existing = data.typography.get(key);
    if (existing) {
      existing.count++;
      if (hasStyle) existing.hasStyle = true;
    } else {
      data.typography.set(key, { key, count: 1, hasStyle: !!hasStyle });
    }
  }

  // Collect spacings
  if (node.itemSpacing != null) data.spacings.push(node.itemSpacing);
  if (node.paddingTop != null) data.spacings.push(node.paddingTop);
  if (node.paddingRight != null) data.spacings.push(node.paddingRight);
  if (node.paddingBottom != null) data.spacings.push(node.paddingBottom);
  if (node.paddingLeft != null) data.spacings.push(node.paddingLeft);

  if (node.children) {
    for (const child of node.children) {
      collectUsageData(child, data);
    }
  }
}

export function calculateConsistencyScore(rootNode: FigmaNode): ConsistencyScore {
  const data = {
    colors: new Map<string, ColorUsage>(),
    typography: new Map<string, TypographyUsage>(),
    spacings: [] as number[],
    totalNodes: 0,
    styledNodes: 0,
  };

  collectUsageData(rootNode, data);

  const findings: string[] = [];

  // Token usage rate
  const tokenUsageRate = data.totalNodes > 0 ? data.styledNodes / data.totalNodes : 0;
  if (tokenUsageRate < 0.5) {
    findings.push(`Low token usage: ${(tokenUsageRate * 100).toFixed(0)}% of nodes reference styles`);
  }

  // Color consistency — fewer unique colors = more consistent
  const uniqueColors = data.colors.size;
  const unstyledColors = Array.from(data.colors.values()).filter((c) => !c.hasStyle);
  const colorConsistency = uniqueColors === 0 ? 10 : Math.max(0, 10 - unstyledColors.length * 0.5);
  if (unstyledColors.length > 5) {
    findings.push(
      `${unstyledColors.length} unique colors without style references: ${unstyledColors.slice(0, 5).map((c) => c.hex).join(", ")}${unstyledColors.length > 5 ? "..." : ""}`
    );
  }

  // Typography consistency
  const uniqueTypo = data.typography.size;
  const unstyledTypo = Array.from(data.typography.values()).filter((t) => !t.hasStyle);
  const typographyConsistency = uniqueTypo === 0 ? 10 : Math.max(0, 10 - unstyledTypo.length * 0.5);
  if (unstyledTypo.length > 3) {
    findings.push(`${unstyledTypo.length} text styles without style references`);
  }

  // Spacing consistency — check 4px grid adherence
  const offGrid = data.spacings.filter((s) => s !== 0 && s % 4 !== 0);
  const spacingConsistency =
    data.spacings.length === 0 ? 10 : Math.max(0, 10 - (offGrid.length / data.spacings.length) * 10);
  if (offGrid.length > 0) {
    findings.push(
      `${offGrid.length}/${data.spacings.length} spacing values off the 4px grid: ${[...new Set(offGrid)].slice(0, 5).join(", ")}px`
    );
  }

  const score =
    tokenUsageRate * 2.5 + colorConsistency * 0.25 + typographyConsistency * 0.25 + spacingConsistency * 0.25;

  return {
    score: Math.round(Math.min(10, score) * 10) / 10,
    tokenUsageRate: Math.round(tokenUsageRate * 1000) / 10,
    colorConsistency: Math.round(colorConsistency * 10) / 10,
    typographyConsistency: Math.round(typographyConsistency * 10) / 10,
    spacingConsistency: Math.round(spacingConsistency * 10) / 10,
    findings,
  };
}
