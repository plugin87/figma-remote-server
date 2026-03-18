import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaApiClient } from "../figma-api.js";
import type { Logger } from "../logger.js";
import { parseFigmaUrl } from "../url-parser.js";
import { compressResponse } from "../response-utils.js";
import { enrichFile } from "../enrichment/enrichment-service.js";
import { calculateConsistencyScore } from "../scoring/consistency.js";
import { scoreTokenArchitecture } from "../scoring/token-architecture.js";
import { DesignSystemKitInput } from "../types/tools.js";

export function registerDesignSystemTools(
  server: McpServer,
  apiClient: FigmaApiClient,
  logger: Logger
): void {
  server.tool(
    "figma_get_design_system_kit",
    "Extract a unified design system kit from a Figma file: tokens, components, styles, relationships, and quality scores. Uses UX/UI Architect intelligence to score across 6 dimensions: Visual Hierarchy, Consistency, Accessibility, Usability, Responsiveness, Performance.",
    DesignSystemKitInput,
    async (args) => {
      try {
        const { fileKey } = parseFigmaUrl(args.file_url_or_key);
        const format = args.format ?? "summary";
        logger.info({ fileKey, format }, "Extracting design system kit");

        // Fetch file with depth appropriate for analysis
        const file = await apiClient.getFile(fileKey, { depth: format === "compact" ? 2 : 5 });

        // Enrichment
        const enrichment = enrichFile(file);

        // Consistency scoring
        const consistencyScore = calculateConsistencyScore(file.document);

        // Token architecture scoring
        const tokenNames = Object.values(file.styles).map((s) => s.name);
        const tokenScore = scoreTokenArchitecture(tokenNames);

        // Build design review scores (6 dimensions from UX/UI CLAUDE.md)
        const scores = {
          visualHierarchy: { weight: "20%", score: "N/A (requires screenshot analysis)" },
          consistency: {
            weight: "20%",
            score: `${consistencyScore.score}/10`,
            details: {
              tokenUsageRate: `${consistencyScore.tokenUsageRate}%`,
              colorConsistency: `${consistencyScore.colorConsistency}/10`,
              typographyConsistency: `${consistencyScore.typographyConsistency}/10`,
              spacingConsistency: `${consistencyScore.spacingConsistency}/10`,
            },
          },
          accessibility: { weight: "20%", score: "Use figma_lint_design for full audit" },
          usability: { weight: "20%", score: "N/A (requires user flow analysis)" },
          responsiveness: { weight: "10%", score: "N/A (requires breakpoint analysis)" },
          performance: { weight: "10%", score: "N/A (requires render analysis)" },
        };

        const kit: Record<string, unknown> = {
          file: enrichment.file,
          qualityScores: scores,
          tokenArchitecture: {
            ...tokenScore,
            assessment:
              tokenScore.score >= 7
                ? "Good token architecture"
                : tokenScore.score >= 4
                  ? "Token architecture needs improvement"
                  : "Significant token architecture issues",
          },
          consistency: {
            ...consistencyScore,
          },
        };

        if (format !== "compact") {
          kit.components = enrichment.componentSummary;
          kit.styles = enrichment.styleSummary;
          kit.relationships = enrichment.relationships;
        }

        if (format === "full") {
          kit.tokenArchitectureCoverage = enrichment.tokenArchitecture.coverage;
          kit.rawComponents = file.components;
          kit.rawComponentSets = file.componentSets;
          kit.rawStyles = file.styles;
        }

        return { content: [{ type: "text", text: compressResponse(kit) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, "figma_get_design_system_kit failed");
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
