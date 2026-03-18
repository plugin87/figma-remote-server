import type { FigmaNode, FigmaColor } from "../types/figma-api.js";
import { contrastRatio, figmaColorToHex, relativeLuminance } from "../enrichment/style-resolver.js";

export type Severity = "critical" | "major" | "minor" | "enhancement";

export interface LintFinding {
  severity: Severity;
  check: string;
  wcagCriterion?: string;
  nodeId: string;
  nodeName: string;
  message: string;
  recommendation: string;
  details?: Record<string, unknown>;
}

// ---- Contrast Check ----

function getEffectiveBackground(node: FigmaNode): FigmaColor | null {
  if (node.fills) {
    for (const fill of node.fills) {
      if (fill.visible !== false && fill.type === "SOLID" && fill.color) {
        return fill.color;
      }
    }
  }
  return null;
}

function getTextColor(node: FigmaNode): FigmaColor | null {
  if (node.fills) {
    for (const fill of node.fills) {
      if (fill.visible !== false && fill.type === "SOLID" && fill.color) {
        return fill.color;
      }
    }
  }
  return null;
}

export function checkContrast(
  node: FigmaNode,
  parentBg: FigmaColor | null
): LintFinding[] {
  const findings: LintFinding[] = [];

  if (node.type === "TEXT" && node.characters) {
    const fg = getTextColor(node);
    const bg = parentBg ?? { r: 1, g: 1, b: 1, a: 1 }; // default white

    if (fg) {
      const ratio = contrastRatio(fg, bg);
      const fontSize = node.style?.fontSize ?? 16;
      const fontWeight = node.style?.fontWeight ?? 400;
      const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const requiredRatio = isLargeText ? 3 : 4.5;

      if (ratio < requiredRatio) {
        findings.push({
          severity: ratio < 2 ? "critical" : "major",
          check: "contrast",
          wcagCriterion: "1.4.3 Contrast (Minimum)",
          nodeId: node.id,
          nodeName: node.name,
          message: `Text "${node.characters.slice(0, 50)}" has contrast ratio ${ratio.toFixed(2)}:1 (required: ${requiredRatio}:1 for ${isLargeText ? "large" : "normal"} text)`,
          recommendation: `Increase contrast to at least ${requiredRatio}:1. Current colors: fg=${figmaColorToHex(fg)}, bg=${figmaColorToHex(bg)}`,
          details: { ratio, required: requiredRatio, fg: figmaColorToHex(fg), bg: figmaColorToHex(bg), fontSize, isLargeText },
        });
      }
    }
  }

  return findings;
}

// ---- Target Size Check ----

const MIN_TARGET_SIZE = 24;
const RECOMMENDED_TARGET_SIZE = 44;

export function checkTargetSize(node: FigmaNode): LintFinding[] {
  const findings: LintFinding[] = [];

  // Check interactive-looking elements
  const isInteractive =
    node.type === "INSTANCE" ||
    node.name.toLowerCase().match(/button|link|toggle|checkbox|radio|switch|tab|chip|close|menu|icon.*button/);

  if (isInteractive && node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox;
    const minDimension = Math.min(width, height);

    if (minDimension < MIN_TARGET_SIZE) {
      findings.push({
        severity: "major",
        check: "target-size",
        wcagCriterion: "2.5.8 Target Size (Minimum)",
        nodeId: node.id,
        nodeName: node.name,
        message: `Interactive element "${node.name}" is ${width}x${height}px — below minimum 24x24px`,
        recommendation: `Increase to at least 24x24px (recommended: 44x44px for primary actions)`,
        details: { width, height, minimum: MIN_TARGET_SIZE, recommended: RECOMMENDED_TARGET_SIZE },
      });
    } else if (minDimension < RECOMMENDED_TARGET_SIZE) {
      findings.push({
        severity: "minor",
        check: "target-size",
        wcagCriterion: "2.5.8 Target Size (Minimum)",
        nodeId: node.id,
        nodeName: node.name,
        message: `Interactive element "${node.name}" is ${width}x${height}px — meets minimum but below recommended 44x44px`,
        recommendation: `Consider increasing to 44x44px for better touch accessibility`,
        details: { width, height, minimum: MIN_TARGET_SIZE, recommended: RECOMMENDED_TARGET_SIZE },
      });
    }
  }

  return findings;
}

// ---- Heading Hierarchy Check ----

export function checkHeadingHierarchy(nodes: FigmaNode[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const textNodes: { node: FigmaNode; fontSize: number }[] = [];

  function collect(node: FigmaNode) {
    if (node.type === "TEXT" && node.style?.fontSize) {
      textNodes.push({ node, fontSize: node.style.fontSize });
    }
    if (node.children) {
      for (const child of node.children) collect(child);
    }
  }

  for (const n of nodes) collect(n);

  // Sort by font size descending to detect hierarchy
  const sorted = textNodes.sort((a, b) => b.fontSize - a.fontSize);
  const uniqueSizes = [...new Set(sorted.map((t) => t.fontSize))].sort((a, b) => b - a);

  // Check for unreasonable jumps in heading sizes
  for (let i = 0; i < uniqueSizes.length - 1; i++) {
    const ratio = uniqueSizes[i] / uniqueSizes[i + 1];
    if (ratio > 2) {
      findings.push({
        severity: "minor",
        check: "heading-hierarchy",
        wcagCriterion: "1.3.1 Info and Relationships",
        nodeId: sorted[0].node.id,
        nodeName: "Typography Scale",
        message: `Large gap in type hierarchy: ${uniqueSizes[i]}px → ${uniqueSizes[i + 1]}px (ratio ${ratio.toFixed(2)}x)`,
        recommendation: `Consider adding an intermediate size. Major Third scale: ${[48, 36, 30, 24, 20, 18, 16, 14, 12].join(", ")}px`,
      });
    }
  }

  return findings;
}

// ---- Spacing Grid Check ----

export function checkSpacingGrid(node: FigmaNode): LintFinding[] {
  const findings: LintFinding[] = [];

  const spacingValues = [
    { name: "paddingTop", value: node.paddingTop },
    { name: "paddingRight", value: node.paddingRight },
    { name: "paddingBottom", value: node.paddingBottom },
    { name: "paddingLeft", value: node.paddingLeft },
    { name: "itemSpacing", value: node.itemSpacing },
  ];

  for (const { name, value } of spacingValues) {
    if (value != null && value !== 0 && value % 4 !== 0) {
      findings.push({
        severity: "minor",
        check: "spacing",
        nodeId: node.id,
        nodeName: node.name,
        message: `${name}=${value}px is not on the 4px spacing grid`,
        recommendation: `Use ${Math.round(value / 4) * 4}px instead`,
        details: { property: name, value, nearest: Math.round(value / 4) * 4 },
      });
    }
  }

  return findings;
}

// ---- Token Usage Check ----

export function checkTokenUsage(
  node: FigmaNode,
  styleMap: Record<string, unknown>
): LintFinding[] {
  const findings: LintFinding[] = [];

  // Check if fills use styles
  if (node.fills && node.fills.length > 0 && node.type !== "TEXT") {
    const hasFillStyle = node.styles && Object.keys(node.styles).some((k) => k.includes("fill"));
    if (!hasFillStyle && node.fills.some((f) => f.visible !== false && f.type === "SOLID")) {
      findings.push({
        severity: "minor",
        check: "token-usage",
        nodeId: node.id,
        nodeName: node.name,
        message: `Node "${node.name}" uses a hardcoded fill color instead of a style/token`,
        recommendation: `Apply a design token from the style library for consistency and dark mode support`,
      });
    }
  }

  return findings;
}

// ---- Full Lint ----

export function lintNode(
  node: FigmaNode,
  parentBg: FigmaColor | null,
  styleMap: Record<string, unknown>,
  checks: Set<string>
): LintFinding[] {
  const findings: LintFinding[] = [];

  if (checks.has("all") || checks.has("contrast")) {
    findings.push(...checkContrast(node, parentBg));
  }
  if (checks.has("all") || checks.has("target-size")) {
    findings.push(...checkTargetSize(node));
  }
  if (checks.has("all") || checks.has("spacing")) {
    findings.push(...checkSpacingGrid(node));
  }
  if (checks.has("all") || checks.has("token-usage")) {
    findings.push(...checkTokenUsage(node, styleMap));
  }

  // Get this node's background for children contrast checks
  const nodeBg = getEffectiveBackground(node) ?? parentBg;

  if (node.children) {
    for (const child of node.children) {
      findings.push(...lintNode(child, nodeBg, styleMap, checks));
    }
  }

  return findings;
}

// ---- Scoring ----

export interface AccessibilityScore {
  score: number; // 0-10
  passing: number;
  failing: number;
  findings: LintFinding[];
  summary: {
    critical: number;
    major: number;
    minor: number;
    enhancement: number;
  };
}

export function calculateAccessibilityScore(findings: LintFinding[]): AccessibilityScore {
  const summary = { critical: 0, major: 0, minor: 0, enhancement: 0 };
  for (const f of findings) {
    summary[f.severity]++;
  }

  // Score calculation: start at 10, deduct for findings
  let score = 10;
  score -= summary.critical * 2;
  score -= summary.major * 1;
  score -= summary.minor * 0.3;
  score -= summary.enhancement * 0.1;
  score = Math.max(0, Math.min(10, score));

  return {
    score: Math.round(score * 10) / 10,
    passing: 0, // Would need total checks count
    failing: findings.length,
    findings,
    summary,
  };
}
