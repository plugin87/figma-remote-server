import { classifyToken, type TokenTier, validateTokenName } from "../enrichment/style-resolver.js";

export interface TokenArchitectureScore {
  score: number; // 0-10
  tierDistribution: Record<TokenTier, number>;
  tierPercentages: Record<TokenTier, string>;
  namingScore: number;
  hierarchyScore: number;
  findings: string[];
}

/**
 * Validate 3-tier token architecture:
 * - Primitive: raw values (color scales, font sizes)
 * - Semantic: purpose-based aliases (primary, surface, text)
 * - Component: scoped to specific components
 *
 * A healthy design system has tokens at all 3 levels with
 * semantic > primitive > component in usage.
 */
export function scoreTokenArchitecture(
  tokenNames: string[]
): TokenArchitectureScore {
  const findings: string[] = [];
  const distribution: Record<TokenTier, number> = { primitive: 0, semantic: 0, component: 0 };
  let namingIssues = 0;

  for (const name of tokenNames) {
    const classification = classifyToken(name);
    distribution[classification.tier]++;

    const naming = validateTokenName(name);
    if (!naming.valid) namingIssues++;
  }

  const total = tokenNames.length;
  if (total === 0) {
    return {
      score: 0,
      tierDistribution: distribution,
      tierPercentages: { primitive: "0%", semantic: "0%", component: "0%" },
      namingScore: 0,
      hierarchyScore: 0,
      findings: ["No tokens found in the design system"],
    };
  }

  const percentages: Record<TokenTier, string> = {
    primitive: `${((distribution.primitive / total) * 100).toFixed(0)}%`,
    semantic: `${((distribution.semantic / total) * 100).toFixed(0)}%`,
    component: `${((distribution.component / total) * 100).toFixed(0)}%`,
  };

  // Hierarchy score — best when semantic > primitive > component
  let hierarchyScore = 10;

  if (distribution.primitive === 0) {
    findings.push("Missing primitive tokens — design system needs raw value definitions (e.g., blue.500, gray.100)");
    hierarchyScore -= 3;
  }
  if (distribution.semantic === 0) {
    findings.push("Missing semantic tokens — need purpose-based aliases (e.g., text.primary, surface.page)");
    hierarchyScore -= 4;
  }
  if (distribution.component === 0 && total > 20) {
    findings.push("No component-scoped tokens — consider adding component tokens (e.g., button.primary.bg)");
    hierarchyScore -= 2;
  }

  // Ideal ratio: ~30% primitive, ~50% semantic, ~20% component
  const semanticRatio = distribution.semantic / total;
  if (semanticRatio < 0.3) {
    findings.push("Low semantic token ratio — most tokens should be semantic (purpose-based)");
    hierarchyScore -= 1;
  }

  // Naming score
  const namingScore = total > 0 ? Math.max(0, 10 - (namingIssues / total) * 10) : 0;
  if (namingIssues > 0) {
    findings.push(
      `${namingIssues}/${total} tokens have naming convention issues. Expected format: {category}.{property}.{variant}-{state}`
    );
  }

  hierarchyScore = Math.max(0, Math.min(10, hierarchyScore));

  const score = (hierarchyScore * 0.6 + namingScore * 0.4);

  return {
    score: Math.round(score * 10) / 10,
    tierDistribution: distribution,
    tierPercentages: percentages,
    namingScore: Math.round(namingScore * 10) / 10,
    hierarchyScore: Math.round(hierarchyScore * 10) / 10,
    findings,
  };
}
