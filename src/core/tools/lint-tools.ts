import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaApiClient } from "../figma-api.js";
import type { Logger } from "../logger.js";
import { parseFigmaUrl } from "../url-parser.js";
import { compressResponse } from "../response-utils.js";
import {
  lintNode,
  checkHeadingHierarchy,
  calculateAccessibilityScore,
  type LintFinding,
} from "../scoring/accessibility.js";
import { LintDesignInput } from "../types/tools.js";

export function registerLintTools(
  server: McpServer,
  apiClient: FigmaApiClient,
  logger: Logger
): void {
  server.tool(
    "figma_lint_design",
    "Lint a Figma design for accessibility (WCAG 2.2 AA), consistency, and design system compliance. Checks contrast ratios, target sizes, heading hierarchy, spacing grid, and token usage. Returns categorized findings: Critical > Major > Minor > Enhancement.",
    LintDesignInput,
    async (args) => {
      try {
        const { fileKey, nodeId: urlNodeId } = parseFigmaUrl(args.file_url_or_key);
        const nodeId = args.node_id ?? urlNodeId;
        const checks = new Set(args.checks ?? ["all"]);
        logger.info({ fileKey, nodeId, checks: [...checks] }, "Linting design");

        let rootNode;

        if (nodeId) {
          const nodesResp = await apiClient.getFileNodes(fileKey, [nodeId], { depth: 10 });
          const nodeData = nodesResp.nodes[nodeId];
          if (!nodeData) {
            return { content: [{ type: "text", text: `Node ${nodeId} not found` }], isError: true };
          }
          rootNode = nodeData.document;
        } else {
          const file = await apiClient.getFile(fileKey, { depth: 5 });
          rootNode = file.document;
        }

        // Get file styles for token usage checks
        const file = await apiClient.getFile(fileKey, { depth: 1 });
        const styleMap = file.styles;

        // Run lint checks
        const findings: LintFinding[] = lintNode(rootNode, null, styleMap, checks);

        // Heading hierarchy check
        if (checks.has("all") || checks.has("heading-hierarchy")) {
          findings.push(...checkHeadingHierarchy(rootNode.children ?? [rootNode]));
        }

        // Calculate score
        const accessibilityScore = calculateAccessibilityScore(findings);

        // Sort findings: critical → major → minor → enhancement
        const severityOrder: Record<string, number> = { critical: 0, major: 1, minor: 2, enhancement: 3 };
        findings.sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));

        const output = {
          score: accessibilityScore.score,
          summary: accessibilityScore.summary,
          totalFindings: findings.length,
          checks: [...checks],
          findings: findings.slice(0, 50), // Limit to 50 findings to avoid context overflow
          truncated: findings.length > 50 ? `${findings.length - 50} additional findings omitted` : undefined,
          wcagReference: {
            "1.4.3": "Contrast (Minimum) — 4.5:1 text, 3:1 large text",
            "2.5.8": "Target Size (Minimum) — 24x24px minimum",
            "1.3.1": "Info and Relationships — heading hierarchy",
          },
        };

        return { content: [{ type: "text", text: compressResponse(output) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, "figma_lint_design failed");
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
