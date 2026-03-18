export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
}

/**
 * Parse a Figma URL or raw file key into { fileKey, nodeId }.
 *
 * Supported URL formats:
 *   https://www.figma.com/file/FILE_KEY/...
 *   https://www.figma.com/design/FILE_KEY/...
 *   https://www.figma.com/board/FILE_KEY/...
 *   https://www.figma.com/design/FILE_KEY/branch/BRANCH_KEY/...
 *   Raw file key (alphanumeric string)
 *
 * Node ID extraction:
 *   ?node-id=1-23 → "1:23"
 *   ?node-id=1:23 → "1:23"
 *   ?node-id=1%3A23 → "1:23"
 */
export function parseFigmaUrl(input: string): ParsedFigmaUrl {
  const trimmed = input.trim();

  // Raw file key — no slashes, no protocol
  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    return { fileKey: trimmed };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // If it's not a valid URL but contains alphanumeric chars, treat as file key
    if (/^[a-zA-Z0-9]+$/.test(trimmed)) {
      return { fileKey: trimmed };
    }
    throw new Error(`Invalid Figma URL or file key: ${trimmed}`);
  }

  // Validate it's a Figma URL
  if (!url.hostname.includes("figma.com")) {
    throw new Error(`Not a Figma URL: ${trimmed}`);
  }

  const pathParts = url.pathname.split("/").filter(Boolean);

  // Expected path: /file|design|board/FILE_KEY/...
  // Or with branch: /design/FILE_KEY/branch/BRANCH_KEY/...
  const typeIndex = pathParts.findIndex((p) =>
    ["file", "design", "board", "make"].includes(p)
  );
  if (typeIndex === -1 || typeIndex + 1 >= pathParts.length) {
    throw new Error(`Cannot extract file key from URL: ${trimmed}`);
  }

  let fileKey = pathParts[typeIndex + 1];

  // Check for branch URL: /design/FILE_KEY/branch/BRANCH_KEY/...
  const branchIndex = pathParts.indexOf("branch", typeIndex + 2);
  if (branchIndex !== -1 && branchIndex + 1 < pathParts.length) {
    fileKey = pathParts[branchIndex + 1];
  }

  // Extract node-id from query params
  let nodeId: string | undefined;
  const nodeIdParam = url.searchParams.get("node-id");
  if (nodeIdParam) {
    // Convert dash-separated format to colon-separated: "1-23" → "1:23"
    nodeId = nodeIdParam.replace(/-/g, ":");
  }

  return { fileKey, nodeId };
}
