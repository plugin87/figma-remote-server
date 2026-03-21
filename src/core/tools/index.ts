import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaApiClient } from "../figma-api.js";
import type { Logger } from "../logger.js";
import type { FigmaConnector } from "../../connectors/figma-connector.js";
import type { DesktopBridgeServer } from "../../connectors/websocket-server.js";
import { registerFileTools } from "./file-tools.js";
import { registerVariableTools } from "./variable-tools.js";
import { registerStyleTools } from "./style-tools.js";
import { registerComponentTools } from "./component-tools.js";
import { registerCommentTools } from "./comment-tools.js";
import { registerDesignSystemTools } from "./design-system-tools.js";
import { registerLintTools } from "./lint-tools.js";
import { registerDesignCodeTools } from "./design-code-tools.js";
import { registerWriteTools } from "./write-tools.js";
import { registerConsoleTools } from "./console-tools.js";

export interface ToolRegistrationOptions {
  server: McpServer;
  apiClient: FigmaApiClient;
  logger: Logger;
  connector: FigmaConnector;
  bridge?: DesktopBridgeServer;
}

/**
 * Register all tools with the MCP server.
 *
 * Read-only tools (REST API based):
 *   - File tools: get_file_data, get_status, get_file_metadata, navigate, get_file_versions
 *   - Variable tools: get_variables
 *   - Style tools: get_styles
 *   - Component tools: get_component, get_component_image
 *   - Comment tools: get_comments, post_comment, delete_comment
 *   - Design system tools: get_design_system_kit
 *   - Lint tools: lint_design
 *   - Design-code tools: check_design_parity, generate_component_doc
 *
 * Write tools (Desktop Bridge required):
 *   - Execute: execute arbitrary Plugin API code
 *   - Variable CRUD: create, update, delete, rename variables and collections
 *   - Batch: batch_create_variables, batch_update_variables, setup_design_tokens
 *   - Node manipulation: resize, move, set_fills, set_strokes, set_text, clone, delete, rename, create_child
 *   - Component ops: instantiate_component, set_description, set_image_fill, arrange_component_set
 *
 * Console tools (local mode only):
 *   - get_console_logs, clear_console, watch_console
 */
export function registerAllTools(options: ToolRegistrationOptions): void {
  const { server, apiClient, logger, connector, bridge } = options;

  // Read-only tools (always available)
  registerFileTools(server, apiClient, logger, connector, bridge);
  registerVariableTools(server, apiClient, logger);
  registerStyleTools(server, apiClient, logger);
  registerComponentTools(server, apiClient, logger);
  registerCommentTools(server, apiClient, logger);
  registerDesignSystemTools(server, apiClient, logger);
  registerLintTools(server, apiClient, logger);
  registerDesignCodeTools(server, apiClient, logger);

  // Write tools (need connector — gracefully degrades with RestOnlyConnector)
  registerWriteTools(server, connector, logger);

  // Console tools (local mode only — need bridge)
  if (bridge) {
    registerConsoleTools(server, bridge, logger);
  }

  logger.info("All tools registered");
}
