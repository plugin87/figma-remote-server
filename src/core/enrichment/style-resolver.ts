import type { FigmaColor, FigmaPaint, FigmaTypeStyle, FigmaEffect } from "../types/figma-api.js";

// ---- Color Conversion ----

export function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  if (color.a < 1) return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(2)})`;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function figmaColorToRgb(color: FigmaColor): { r: number; g: number; b: number; a: number } {
  return {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255),
    a: color.a,
  };
}

/**
 * Calculate relative luminance per WCAG 2.x
 * Uses sRGB linearization
 */
export function relativeLuminance(color: FigmaColor): number {
  const [r, g, b] = [color.r, color.g, color.b].map((c) => {
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors per WCAG 2.x
 */
export function contrastRatio(fg: FigmaColor, bg: FigmaColor): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---- Typography ----

/** Major Third (1.25) type scale reference values */
const TYPE_SCALE_MAJOR_THIRD = [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72];

/**
 * Check if a font size follows the Major Third (1.25) type scale
 */
export function isOnTypeScale(fontSize: number, tolerance = 1): boolean {
  return TYPE_SCALE_MAJOR_THIRD.some((s) => Math.abs(fontSize - s) <= tolerance);
}

/**
 * Find nearest type scale value
 */
export function nearestTypeScaleValue(fontSize: number): number {
  return TYPE_SCALE_MAJOR_THIRD.reduce((closest, s) =>
    Math.abs(fontSize - s) < Math.abs(fontSize - closest) ? s : closest
  );
}

// ---- Spacing ----

const SPACING_BASE = 4;

/**
 * Check if a value aligns to the 4px spacing grid
 */
export function isOnSpacingGrid(value: number): boolean {
  if (value === 0) return true;
  return value % SPACING_BASE === 0;
}

/**
 * Find nearest 4px grid value
 */
export function nearestSpacingGridValue(value: number): number {
  return Math.round(value / SPACING_BASE) * SPACING_BASE;
}

// ---- Token Naming ----

/**
 * Validate token naming against convention: {category}.{property}.{variant}-{state}
 */
export function validateTokenName(name: string): { valid: boolean; suggestion?: string; issues: string[] } {
  const issues: string[] = [];

  // Convert Figma slash-separated naming to dot notation
  const normalized = name.replace(/\//g, ".").replace(/\s+/g, "-").toLowerCase();
  const parts = normalized.split(".");

  if (parts.length < 2) {
    issues.push("Token name should have at least 2 levels (e.g., color.primary)");
  }

  // Check for common bad patterns
  if (/[A-Z]/.test(name.replace(/\//g, ""))) {
    issues.push("Token names should be lowercase");
  }
  if (name.includes(" ")) {
    issues.push("Use hyphens instead of spaces");
  }

  return { valid: issues.length === 0, suggestion: normalized, issues };
}

// ---- 3-Tier Token Architecture ----

export type TokenTier = "primitive" | "semantic" | "component";

export interface TokenClassification {
  tier: TokenTier;
  confidence: number;
  reasoning: string;
}

/**
 * Classify a token into the 3-tier hierarchy based on its name/path
 */
export function classifyToken(name: string): TokenClassification {
  const lower = name.toLowerCase();
  const parts = lower.split(/[./]/);

  // Component-tier indicators
  if (
    parts.some((p) =>
      ["button", "input", "card", "modal", "header", "sidebar", "badge", "avatar", "tooltip", "dropdown", "alert", "table"].includes(p)
    )
  ) {
    return { tier: "component", confidence: 0.9, reasoning: "Name contains a component identifier" };
  }

  // Semantic-tier indicators
  if (
    parts.some((p) =>
      ["primary", "secondary", "success", "warning", "error", "info", "danger", "action", "surface", "text", "border", "background", "foreground", "muted", "accent", "destructive", "disabled", "interactive", "feedback"].includes(p)
    )
  ) {
    return { tier: "semantic", confidence: 0.85, reasoning: "Name uses semantic/purpose-based naming" };
  }

  // Primitive-tier indicators
  if (
    parts.some((p) =>
      ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"].includes(p)
    ) ||
    parts.some((p) =>
      ["red", "blue", "green", "yellow", "purple", "orange", "pink", "gray", "grey", "slate", "zinc", "neutral", "stone", "amber", "emerald", "teal", "cyan", "sky", "indigo", "violet", "fuchsia", "rose", "lime"].includes(p)
    )
  ) {
    return { tier: "primitive", confidence: 0.9, reasoning: "Name uses raw color/scale values" };
  }

  return { tier: "semantic", confidence: 0.5, reasoning: "Default classification — insufficient signals" };
}

// ---- Fill/Effect to CSS ----

export function paintToCss(paint: FigmaPaint): string | null {
  if (paint.visible === false) return null;
  if (paint.type === "SOLID" && paint.color) {
    const hex = figmaColorToHex(paint.color);
    if (paint.opacity != null && paint.opacity < 1) {
      const rgb = figmaColorToRgb(paint.color);
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(paint.opacity * paint.color.a).toFixed(2)})`;
    }
    return hex;
  }
  if (paint.type === "GRADIENT_LINEAR" && paint.gradientStops) {
    const stops = paint.gradientStops
      .map((s) => `${figmaColorToHex(s.color)} ${(s.position * 100).toFixed(0)}%`)
      .join(", ");
    return `linear-gradient(${stops})`;
  }
  return null;
}

export function effectToCss(effect: FigmaEffect): string | null {
  if (effect.visible === false) return null;
  if (effect.type === "DROP_SHADOW" && effect.color && effect.offset) {
    const color = figmaColorToHex(effect.color);
    return `${effect.offset.x}px ${effect.offset.y}px ${effect.radius ?? 0}px ${effect.spread ?? 0}px ${color}`;
  }
  if (effect.type === "INNER_SHADOW" && effect.color && effect.offset) {
    const color = figmaColorToHex(effect.color);
    return `inset ${effect.offset.x}px ${effect.offset.y}px ${effect.radius ?? 0}px ${effect.spread ?? 0}px ${color}`;
  }
  if (effect.type === "LAYER_BLUR") {
    return `blur(${effect.radius ?? 0}px)`;
  }
  if (effect.type === "BACKGROUND_BLUR") {
    return `blur(${effect.radius ?? 0}px)`;
  }
  return null;
}

export function typographyToCss(style: FigmaTypeStyle): Record<string, string> {
  const css: Record<string, string> = {};
  if (style.fontFamily) css["font-family"] = `"${style.fontFamily}"`;
  if (style.fontSize) css["font-size"] = `${style.fontSize}px`;
  if (style.fontWeight) css["font-weight"] = String(style.fontWeight);
  if (style.lineHeightPx) css["line-height"] = `${style.lineHeightPx}px`;
  if (style.letterSpacing) css["letter-spacing"] = `${style.letterSpacing}px`;
  if (style.textAlignHorizontal) css["text-align"] = style.textAlignHorizontal.toLowerCase();
  if (style.textCase === "UPPER") css["text-transform"] = "uppercase";
  if (style.textCase === "LOWER") css["text-transform"] = "lowercase";
  if (style.textDecoration === "UNDERLINE") css["text-decoration"] = "underline";
  if (style.textDecoration === "STRIKETHROUGH") css["text-decoration"] = "line-through";
  if (style.italic) css["font-style"] = "italic";
  return css;
}
