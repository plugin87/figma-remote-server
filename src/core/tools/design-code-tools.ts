import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaApiClient } from "../figma-api.js";
import type { Logger } from "../logger.js";
import { parseFigmaUrl } from "../url-parser.js";
import { compressResponse } from "../response-utils.js";
import type { FigmaNode } from "../types/figma-api.js";
import { figmaColorToHex, paintToCss, typographyToCss, effectToCss } from "../enrichment/style-resolver.js";
import { DesignParityInput, ComponentDocInput } from "../types/tools.js";

// ---- Design-Code Parity ----

interface ParityDiscrepancy {
  property: string;
  designValue: string;
  codeValue: string | undefined;
  category: "color" | "typography" | "spacing" | "border" | "shadow" | "other";
  severity: "high" | "medium" | "low";
}

function extractDesignTokens(node: FigmaNode): Record<string, string> {
  const tokens: Record<string, string> = {};

  // Colors
  if (node.fills) {
    for (const fill of node.fills) {
      if (fill.visible !== false && fill.type === "SOLID" && fill.color) {
        tokens["background-color"] = figmaColorToHex(fill.color);
      }
    }
  }

  // Typography
  if (node.style) {
    const css = typographyToCss(node.style);
    Object.assign(tokens, css);
  }

  // Spacing
  if (node.paddingTop != null) tokens["padding-top"] = `${node.paddingTop}px`;
  if (node.paddingRight != null) tokens["padding-right"] = `${node.paddingRight}px`;
  if (node.paddingBottom != null) tokens["padding-bottom"] = `${node.paddingBottom}px`;
  if (node.paddingLeft != null) tokens["padding-left"] = `${node.paddingLeft}px`;
  if (node.itemSpacing != null) tokens["gap"] = `${node.itemSpacing}px`;

  // Border
  if (node.cornerRadius != null) tokens["border-radius"] = `${node.cornerRadius}px`;
  if (node.strokes && node.strokes.length > 0) {
    const stroke = node.strokes[0];
    if (stroke.visible !== false && stroke.color) {
      tokens["border-color"] = figmaColorToHex(stroke.color);
    }
  }
  if (node.strokeWeight != null) tokens["border-width"] = `${node.strokeWeight}px`;

  // Effects
  if (node.effects) {
    const shadows = node.effects
      .filter((e) => e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW")
      .map((e) => effectToCss(e))
      .filter(Boolean);
    if (shadows.length > 0) tokens["box-shadow"] = shadows.join(", ");
  }

  // Size
  if (node.absoluteBoundingBox) {
    tokens["width"] = `${node.absoluteBoundingBox.width}px`;
    tokens["height"] = `${node.absoluteBoundingBox.height}px`;
  }

  // Layout
  if (node.layoutMode === "HORIZONTAL") tokens["display"] = "flex";
  if (node.layoutMode === "VERTICAL") {
    tokens["display"] = "flex";
    tokens["flex-direction"] = "column";
  }

  return tokens;
}

function categorizeProperty(prop: string): ParityDiscrepancy["category"] {
  if (prop.includes("color") || prop.includes("background")) return "color";
  if (prop.includes("font") || prop.includes("text") || prop.includes("line-height") || prop.includes("letter-spacing")) return "typography";
  if (prop.includes("padding") || prop.includes("margin") || prop.includes("gap")) return "spacing";
  if (prop.includes("border")) return "border";
  if (prop.includes("shadow")) return "shadow";
  return "other";
}

// ---- Component Documentation ----

function generateComponentDoc(node: FigmaNode, fileKey: string): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    name: node.name,
    type: node.type,
    id: node.id,
    figmaUrl: `https://www.figma.com/design/${fileKey}/?node-id=${node.id.replace(/:/g, "-")}`,
  };

  // Anatomy
  if (node.children) {
    doc.anatomy = node.children.map((child) => ({
      name: child.name,
      type: child.type,
      role: child.type === "TEXT" ? "text" : child.type === "INSTANCE" ? "component" : "container",
    }));
  }

  // Variants (from component set)
  if (node.type === "COMPONENT_SET" && node.children) {
    const variants: Record<string, Set<string>> = {};
    for (const child of node.children) {
      // Parse variant name "Property=Value, Property=Value"
      const pairs = child.name.split(",").map((p) => p.trim().split("="));
      for (const [key, value] of pairs) {
        if (key && value) {
          if (!variants[key]) variants[key] = new Set();
          variants[key].add(value);
        }
      }
    }
    doc.variants = Object.fromEntries(
      Object.entries(variants).map(([k, v]) => [k, [...v]])
    );
    doc.variantCount = node.children.length;
  }

  // Component properties
  if (node.componentPropertyDefinitions) {
    doc.properties = node.componentPropertyDefinitions;
  }

  // Design tokens used
  const tokens = extractDesignTokens(node);
  doc.designTokens = tokens;

  // States detection (from variant names or children)
  const stateKeywords = ["default", "hover", "focus", "active", "pressed", "disabled", "loading", "error", "selected"];
  if (node.children) {
    const detectedStates = node.children
      .map((c) => c.name.toLowerCase())
      .flatMap((name) => stateKeywords.filter((s) => name.includes(s)));
    const uniqueStates = [...new Set(detectedStates)];
    doc.states = {
      detected: uniqueStates,
      required: stateKeywords,
      missing: stateKeywords.filter((s) => !uniqueStates.includes(s)),
      coverage: `${uniqueStates.length}/${stateKeywords.length}`,
    };
  }

  // Size
  if (node.absoluteBoundingBox) {
    doc.dimensions = {
      width: node.absoluteBoundingBox.width,
      height: node.absoluteBoundingBox.height,
    };
  }

  // Accessibility hints
  doc.accessibilityNotes = {
    interactiveType: guessAriaRole(node),
    keyboardModel: guessKeyboardModel(node),
    screenReaderLabel: node.name,
  };

  // Handoff checklist from UX/UI CLAUDE.md
  doc.handoffChecklist = {
    "All values mapped to tokens": Object.keys(tokens).length > 0 ? "Partially" : "No tokens detected",
    "All 8 states documented": doc.states ? `${(doc.states as { coverage: string }).coverage}` : "Unknown",
    "Edge cases addressed": "Manual review needed",
    "Responsive behavior specified": "Manual review needed",
    "Animation specified": "Manual review needed",
    "Accessibility annotations": "See accessibilityNotes above",
  };

  return doc;
}

function guessAriaRole(node: FigmaNode): string {
  const name = node.name.toLowerCase();
  if (name.includes("button")) return "button";
  if (name.includes("input") || name.includes("text field")) return "textbox";
  if (name.includes("checkbox")) return "checkbox";
  if (name.includes("radio")) return "radio";
  if (name.includes("toggle") || name.includes("switch")) return "switch";
  if (name.includes("tab")) return "tab";
  if (name.includes("dropdown") || name.includes("select")) return "combobox";
  if (name.includes("modal") || name.includes("dialog")) return "dialog";
  if (name.includes("tooltip")) return "tooltip";
  if (name.includes("menu")) return "menu";
  if (name.includes("link")) return "link";
  return "generic";
}

function guessKeyboardModel(node: FigmaNode): string {
  const role = guessAriaRole(node);
  const models: Record<string, string> = {
    button: "Enter/Space to activate, Tab to focus",
    textbox: "Tab to focus, type to input",
    checkbox: "Space to toggle, Tab to focus",
    radio: "Arrow keys to select, Tab to group",
    switch: "Space to toggle, Tab to focus",
    tab: "Arrow keys to switch tabs, Tab to focus",
    combobox: "Arrow keys to navigate, Enter to select, Escape to close",
    dialog: "Tab trapped inside, Escape to close, focus returns on close",
    tooltip: "Focus/hover triggers, Escape dismisses",
    menu: "Arrow keys to navigate, Enter to select, Escape to close",
    link: "Enter to follow, Tab to focus",
  };
  return models[role] ?? "Tab to focus";
}

// ---- Registration ----

export function registerDesignCodeTools(
  server: McpServer,
  apiClient: FigmaApiClient,
  logger: Logger
): void {
  // ---- figma_check_design_parity ----
  server.tool(
    "figma_check_design_parity",
    "Compare design token values from Figma against code token values to find discrepancies. Returns a parity score (0-100) with categorized differences.",
    DesignParityInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        logger.info({ fileKey, nodeId: args.node_id }, "Checking design-code parity");

        const nodesResp = await apiClient.getFileNodes(fileKey, [args.node_id], { depth: 5 });
        const nodeData = nodesResp.nodes[args.node_id];
        if (!nodeData) {
          return { content: [{ type: "text", text: `Node ${args.node_id} not found` }], isError: true };
        }

        const designTokens = extractDesignTokens(nodeData.document);
        const codeTokens = args.code_tokens ?? {};

        const discrepancies: ParityDiscrepancy[] = [];
        let matching = 0;
        let total = 0;

        for (const [prop, designValue] of Object.entries(designTokens)) {
          total++;
          const codeValue = codeTokens[prop];
          if (codeValue === undefined) {
            discrepancies.push({
              property: prop,
              designValue,
              codeValue: undefined,
              category: categorizeProperty(prop),
              severity: "medium",
            });
          } else if (codeValue !== designValue) {
            discrepancies.push({
              property: prop,
              designValue,
              codeValue,
              category: categorizeProperty(prop),
              severity: "high",
            });
          } else {
            matching++;
          }
        }

        const parityScore = total > 0 ? Math.round((matching / total) * 100) : 100;

        const output = {
          parityScore,
          matching,
          total,
          discrepancies: discrepancies.sort(
            (a, b) => (a.severity === "high" ? 0 : 1) - (b.severity === "high" ? 0 : 1)
          ),
          designTokens,
          summary: {
            missingInCode: discrepancies.filter((d) => d.codeValue === undefined).length,
            mismatched: discrepancies.filter((d) => d.codeValue !== undefined).length,
            byCategory: discrepancies.reduce(
              (acc, d) => {
                acc[d.category] = (acc[d.category] ?? 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            ),
          },
        };

        return { content: [{ type: "text", text: compressResponse(output) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- figma_generate_component_doc ----
  server.tool(
    "figma_generate_component_doc",
    "Generate comprehensive component documentation from a Figma component. Includes anatomy, variants, states, token mapping, ARIA patterns, keyboard model, and handoff checklist following UX/UI quality bar.",
    ComponentDocInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        const format = args.format ?? "markdown";
        logger.info({ fileKey, nodeId: args.node_id, format }, "Generating component doc");

        const nodesResp = await apiClient.getFileNodes(fileKey, [args.node_id], { depth: 10 });
        const nodeData = nodesResp.nodes[args.node_id];
        if (!nodeData) {
          return { content: [{ type: "text", text: `Node ${args.node_id} not found` }], isError: true };
        }

        const doc = generateComponentDoc(nodeData.document, fileKey);

        if (format === "markdown") {
          const md = generateMarkdownDoc(doc);
          return { content: [{ type: "text", text: md }] };
        }

        return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );
}

function generateMarkdownDoc(doc: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`# ${doc.name}`);
  lines.push(`**Type:** ${doc.type} | **ID:** \`${doc.id}\``);
  if (doc.figmaUrl) lines.push(`**Figma:** [Open in Figma](${doc.figmaUrl})`);
  lines.push("");

  // Anatomy
  if (doc.anatomy) {
    lines.push("## Anatomy");
    lines.push("| Part | Type | Role |");
    lines.push("|------|------|------|");
    for (const part of doc.anatomy as { name: string; type: string; role: string }[]) {
      lines.push(`| ${part.name} | ${part.type} | ${part.role} |`);
    }
    lines.push("");
  }

  // Variants
  if (doc.variants) {
    lines.push("## Variants");
    for (const [prop, values] of Object.entries(doc.variants as Record<string, string[]>)) {
      lines.push(`- **${prop}:** ${values.join(", ")}`);
    }
    lines.push(`\n*Total variants: ${doc.variantCount}*`);
    lines.push("");
  }

  // States
  if (doc.states) {
    const states = doc.states as { detected: string[]; missing: string[]; coverage: string };
    lines.push("## States");
    lines.push(`Coverage: ${states.coverage}`);
    lines.push(`- **Detected:** ${states.detected.join(", ") || "none"}`);
    lines.push(`- **Missing:** ${states.missing.join(", ") || "none"}`);
    lines.push("");
  }

  // Dimensions
  if (doc.dimensions) {
    const dim = doc.dimensions as { width: number; height: number };
    lines.push(`## Dimensions`);
    lines.push(`${dim.width} x ${dim.height}px`);
    lines.push("");
  }

  // Design tokens
  if (doc.designTokens) {
    lines.push("## Design Tokens");
    lines.push("| Property | Value |");
    lines.push("|----------|-------|");
    for (const [prop, val] of Object.entries(doc.designTokens as Record<string, string>)) {
      lines.push(`| \`${prop}\` | \`${val}\` |`);
    }
    lines.push("");
  }

  // Accessibility
  if (doc.accessibilityNotes) {
    const a11y = doc.accessibilityNotes as { interactiveType: string; keyboardModel: string; screenReaderLabel: string };
    lines.push("## Accessibility");
    lines.push(`- **ARIA Role:** \`${a11y.interactiveType}\``);
    lines.push(`- **Keyboard:** ${a11y.keyboardModel}`);
    lines.push(`- **Screen Reader:** "${a11y.screenReaderLabel}"`);
    lines.push("");
  }

  // Handoff checklist
  if (doc.handoffChecklist) {
    lines.push("## Handoff Checklist");
    for (const [item, status] of Object.entries(doc.handoffChecklist as Record<string, string>)) {
      const icon = status === "Yes" || status.includes("/8") ? "x" : " ";
      lines.push(`- [${icon}] ${item}: ${status}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
