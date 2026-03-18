import type { FigmaNode, FigmaFileResponse } from "../types/figma-api.js";

export interface RelationshipGraph {
  components: Map<string, ComponentRelation>;
  styles: Map<string, StyleRelation>;
  dependencies: DependencyEdge[];
}

export interface ComponentRelation {
  id: string;
  name: string;
  type: string;
  usedStyles: string[];
  usedComponents: string[];
  usedBy: string[];
  variants?: string[];
}

export interface StyleRelation {
  id: string;
  name: string;
  type: string;
  usedBy: string[];
}

export interface DependencyEdge {
  from: string;
  fromType: "component" | "style" | "variable";
  to: string;
  toType: "component" | "style" | "variable";
  relation: "uses" | "variant_of" | "instance_of";
}

/**
 * Build a cross-reference graph: component ↔ style ↔ variable dependencies
 */
export function buildRelationshipGraph(file: FigmaFileResponse): RelationshipGraph {
  const components = new Map<string, ComponentRelation>();
  const styles = new Map<string, StyleRelation>();
  const dependencies: DependencyEdge[] = [];

  // Initialize styles from file metadata
  for (const [id, style] of Object.entries(file.styles)) {
    styles.set(id, {
      id,
      name: style.name,
      type: style.styleType,
      usedBy: [],
    });
  }

  // Walk the document tree
  function walkNode(node: FigmaNode, parentComponentId?: string): void {
    const isComponent = node.type === "COMPONENT" || node.type === "COMPONENT_SET";
    const currentComponentId = isComponent ? node.id : parentComponentId;

    if (isComponent) {
      const existing = components.get(node.id);
      if (!existing) {
        components.set(node.id, {
          id: node.id,
          name: node.name,
          type: node.type,
          usedStyles: [],
          usedComponents: [],
          usedBy: [],
        });
      }
    }

    // Track component instances
    if (node.type === "INSTANCE" && node.componentId) {
      if (currentComponentId && currentComponentId !== node.componentId) {
        const parent = components.get(currentComponentId);
        if (parent && !parent.usedComponents.includes(node.componentId)) {
          parent.usedComponents.push(node.componentId);
        }

        const child = components.get(node.componentId);
        if (child && !child.usedBy.includes(currentComponentId)) {
          child.usedBy.push(currentComponentId);
        }

        dependencies.push({
          from: currentComponentId,
          fromType: "component",
          to: node.componentId,
          toType: "component",
          relation: "instance_of",
        });
      }
    }

    // Track style references
    if (node.styles && currentComponentId) {
      for (const styleId of Object.values(node.styles)) {
        const comp = components.get(currentComponentId);
        if (comp && !comp.usedStyles.includes(styleId)) {
          comp.usedStyles.push(styleId);
        }

        const style = styles.get(styleId);
        if (style && !style.usedBy.includes(currentComponentId)) {
          style.usedBy.push(currentComponentId);
        }

        dependencies.push({
          from: currentComponentId,
          fromType: "component",
          to: styleId,
          toType: "style",
          relation: "uses",
        });
      }
    }

    // Track component set → variant relationships
    if (node.type === "COMPONENT_SET" && node.children) {
      const parentComp = components.get(node.id);
      if (parentComp) {
        parentComp.variants = node.children
          .filter((c) => c.type === "COMPONENT")
          .map((c) => c.id);
      }
      for (const child of node.children) {
        if (child.type === "COMPONENT") {
          dependencies.push({
            from: child.id,
            fromType: "component",
            to: node.id,
            toType: "component",
            relation: "variant_of",
          });
        }
      }
    }

    if (node.children) {
      for (const child of node.children) {
        walkNode(child, currentComponentId);
      }
    }
  }

  walkNode(file.document);

  return { components, styles, dependencies };
}

/**
 * Serialize relationship graph for output
 */
export function serializeRelationshipGraph(graph: RelationshipGraph): Record<string, unknown> {
  return {
    components: Array.from(graph.components.values()).map((c) => ({
      ...c,
      variantCount: c.variants?.length ?? 0,
    })),
    styles: Array.from(graph.styles.values()),
    dependencies: graph.dependencies,
    summary: {
      totalComponents: graph.components.size,
      totalStyles: graph.styles.size,
      totalDependencies: graph.dependencies.length,
      orphanStyles: Array.from(graph.styles.values())
        .filter((s) => s.usedBy.length === 0)
        .map((s) => s.name),
    },
  };
}
