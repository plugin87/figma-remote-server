import type { FigmaFileResponse, FigmaNode } from "../types/figma-api.js";
import { buildRelationshipGraph, serializeRelationshipGraph } from "./relationship-mapper.js";
import { classifyToken, type TokenTier } from "./style-resolver.js";

export interface EnrichmentResult {
  file: {
    name: string;
    lastModified: string;
    version: string;
  };
  tokenArchitecture: {
    primitive: number;
    semantic: number;
    component: number;
    unclassified: number;
    coverage: Record<TokenTier, string[]>;
  };
  relationships: ReturnType<typeof serializeRelationshipGraph>;
  componentSummary: {
    total: number;
    withVariants: number;
    withDescription: number;
    withDocLinks: number;
  };
  styleSummary: {
    total: number;
    byType: Record<string, number>;
    orphaned: number;
  };
}

/**
 * Enrich a Figma file with relationship mapping, token architecture analysis,
 * and design system metadata.
 */
export function enrichFile(file: FigmaFileResponse): EnrichmentResult {
  const graph = buildRelationshipGraph(file);
  const serialized = serializeRelationshipGraph(graph);

  // Token architecture analysis
  const coverage: Record<TokenTier, string[]> = { primitive: [], semantic: [], component: [] };
  let unclassified = 0;

  for (const [, style] of Object.entries(file.styles)) {
    const classification = classifyToken(style.name);
    if (classification.confidence >= 0.7) {
      coverage[classification.tier].push(style.name);
    } else {
      unclassified++;
    }
  }

  // Component summary
  const components = Object.values(file.components);
  const componentSets = Object.values(file.componentSets);

  return {
    file: {
      name: file.name,
      lastModified: file.lastModified,
      version: file.version,
    },
    tokenArchitecture: {
      primitive: coverage.primitive.length,
      semantic: coverage.semantic.length,
      component: coverage.component.length,
      unclassified,
      coverage,
    },
    relationships: serialized,
    componentSummary: {
      total: components.length,
      withVariants: componentSets.length,
      withDescription: components.filter((c) => c.description.length > 0).length,
      withDocLinks: components.filter((c) => c.documentationLinks && c.documentationLinks.length > 0).length,
    },
    styleSummary: {
      total: Object.keys(file.styles).length,
      byType: Object.values(file.styles).reduce(
        (acc, s) => {
          acc[s.styleType] = (acc[s.styleType] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      orphaned: (serialized.summary as { orphanStyles: string[] }).orphanStyles.length,
    },
  };
}
