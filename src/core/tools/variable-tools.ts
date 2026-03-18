import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaApiClient } from "../figma-api.js";
import type { Logger } from "../logger.js";
import { parseFigmaUrl } from "../url-parser.js";
import { compressResponse } from "../response-utils.js";
import type { FigmaColor, FigmaVariable, FigmaVariableCollection, FigmaVariableValue } from "../types/figma-api.js";
import { GetVariablesInput } from "../types/tools.js";

// ---- Helpers ----

function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a;
  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function resolveAlias(
  value: FigmaVariableValue,
  variables: Record<string, FigmaVariable>,
  modeId: string,
  depth = 0
): { resolved: FigmaVariableValue; aliasChain: string[] } {
  if (depth > 10) return { resolved: value, aliasChain: [] };
  if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
    const aliasVar = variables[value.id];
    if (!aliasVar) return { resolved: value, aliasChain: [value.id] };
    const aliasValue = aliasVar.valuesByMode[modeId] ?? Object.values(aliasVar.valuesByMode)[0];
    if (aliasValue === undefined) return { resolved: value, aliasChain: [aliasVar.name] };
    const deeper = resolveAlias(aliasValue, variables, modeId, depth + 1);
    return { resolved: deeper.resolved, aliasChain: [aliasVar.name, ...deeper.aliasChain] };
  }
  return { resolved: value, aliasChain: [] };
}

function variableNameToToken(name: string): string {
  return name.replace(/\//g, ".").replace(/\s+/g, "-").toLowerCase();
}

function formatValue(value: FigmaVariableValue, resolvedType: string): string {
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    return resolvedType === "FLOAT" ? String(value) : String(value);
  }
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    if ("type" in value && value.type === "VARIABLE_ALIAS") return `→ alias(${value.id})`;
    if ("r" in value) return figmaColorToHex(value as FigmaColor);
  }
  return JSON.stringify(value);
}

// ---- Formatters ----

interface ResolvedVariable {
  name: string;
  token: string;
  collection: string;
  resolvedType: string;
  description: string;
  scopes: string[];
  values: Record<string, { raw: string; resolved: string; aliasChain: string[] }>;
}

function formatAsCss(vars: ResolvedVariable[]): string {
  const lines = [":root {"];
  for (const v of vars) {
    const firstValue = Object.values(v.values)[0];
    if (!firstValue) continue;
    lines.push(`  --${v.token}: ${firstValue.resolved};${v.description ? ` /* ${v.description} */` : ""}`);
  }
  lines.push("}");
  return lines.join("\n");
}

function formatAsScss(vars: ResolvedVariable[]): string {
  const lines: string[] = [];
  for (const v of vars) {
    const firstValue = Object.values(v.values)[0];
    if (!firstValue) continue;
    lines.push(`$${v.token}: ${firstValue.resolved};${v.description ? ` // ${v.description}` : ""}`);
  }
  return lines.join("\n");
}

function formatAsTailwind(vars: ResolvedVariable[]): string {
  const theme: Record<string, Record<string, string>> = {};
  for (const v of vars) {
    const firstValue = Object.values(v.values)[0];
    if (!firstValue) continue;
    const category = v.resolvedType === "COLOR" ? "colors" : v.resolvedType === "FLOAT" ? "spacing" : "values";
    if (!theme[category]) theme[category] = {};
    theme[category][v.token] = firstValue.resolved;
  }
  return `// tailwind.config.ts theme extension\n${JSON.stringify({ extend: theme }, null, 2)}`;
}

function formatAsTypescript(vars: ResolvedVariable[]): string {
  const lines = ["export const tokens = {"];
  for (const v of vars) {
    const firstValue = Object.values(v.values)[0];
    if (!firstValue) continue;
    const tsValue = v.resolvedType === "FLOAT" ? firstValue.resolved : `"${firstValue.resolved}"`;
    lines.push(`  "${v.token}": ${tsValue},`);
  }
  lines.push("} as const;");
  lines.push("");
  lines.push("export type TokenName = keyof typeof tokens;");
  return lines.join("\n");
}

function formatVariables(vars: ResolvedVariable[], format: string): string {
  switch (format) {
    case "css":
      return formatAsCss(vars);
    case "scss":
      return formatAsScss(vars);
    case "tailwind":
      return formatAsTailwind(vars);
    case "typescript":
      return formatAsTypescript(vars);
    case "json":
      return JSON.stringify(vars, null, 2);
    default:
      return JSON.stringify(vars, null, 2);
  }
}

// ---- Tool Registration ----

export function registerVariableTools(
  server: McpServer,
  apiClient: FigmaApiClient,
  logger: Logger
): void {
  server.tool(
    "figma_get_variables",
    "Extract design variables/tokens from a Figma file with alias resolution and multi-format code export. Supports CSS, SCSS, Tailwind, TypeScript, and JSON output.",
    GetVariablesInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        const format = args.format ?? "raw";
        logger.info({ fileKey, format }, "Fetching variables");

        let variablesData: { variables: Record<string, FigmaVariable>; variableCollections: Record<string, FigmaVariableCollection> };

        try {
          const response = await apiClient.getLocalVariables(fileKey);
          variablesData = response.meta;
        } catch (apiError) {
          // Fallback: try to extract variables from file tree
          logger.warn("Variables API failed, falling back to file tree extraction");
          const file = await apiClient.getFile(fileKey, { depth: 1 });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    warning:
                      "Variables REST API not available (requires Enterprise plan). Showing file-level styles instead.",
                    styles: file.styles,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const { variables, variableCollections } = variablesData;

        // Resolve and format
        const resolved: ResolvedVariable[] = [];
        for (const variable of Object.values(variables)) {
          const collection = variableCollections[variable.variableCollectionId];
          if (!collection) continue;

          // Filter by collection name if specified
          if (args.collection_name && collection.name !== args.collection_name) continue;

          const values: Record<string, { raw: string; resolved: string; aliasChain: string[] }> = {};
          for (const mode of collection.modes) {
            const rawValue = variable.valuesByMode[mode.modeId];
            if (rawValue === undefined) continue;
            const { resolved: resolvedValue, aliasChain } = resolveAlias(
              rawValue,
              variables,
              mode.modeId
            );
            values[mode.name] = {
              raw: formatValue(rawValue, variable.resolvedType),
              resolved: formatValue(resolvedValue, variable.resolvedType),
              aliasChain,
            };
          }

          resolved.push({
            name: variable.name,
            token: variableNameToToken(variable.name),
            collection: collection.name,
            resolvedType: variable.resolvedType,
            description: variable.description,
            scopes: variable.scopes,
            values,
          });
        }

        // Sort by collection → name
        resolved.sort((a, b) =>
          a.collection === b.collection ? a.name.localeCompare(b.name) : a.collection.localeCompare(b.collection)
        );

        const output =
          format === "raw"
            ? compressResponse({
                collections: Object.values(variableCollections).map((c) => ({
                  name: c.name,
                  modes: c.modes.map((m) => m.name),
                  variableCount: c.variableIds.length,
                })),
                variables: resolved,
                summary: {
                  totalVariables: resolved.length,
                  totalCollections: Object.keys(variableCollections).length,
                  byType: resolved.reduce(
                    (acc, v) => {
                      acc[v.resolvedType] = (acc[v.resolvedType] ?? 0) + 1;
                      return acc;
                    },
                    {} as Record<string, number>
                  ),
                },
              })
            : formatVariables(resolved, format);

        return { content: [{ type: "text", text: output }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, "figma_get_variables failed");
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
