import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaConnector } from "../../connectors/figma-connector.js";
import type { Logger } from "../logger.js";

function makeCommandId(): string {
  return crypto.randomUUID();
}

export function registerWriteTools(
  server: McpServer,
  connector: FigmaConnector,
  logger: Logger
): void {
  // ---- figma_execute ----
  server.tool(
    "figma_execute",
    "Execute arbitrary Figma Plugin API JavaScript code in the plugin context. The code runs inside the Figma plugin sandbox with access to figma.* APIs. Use for operations not covered by other tools.\n\nIMPORTANT: The code is evaluated with new Function() in an ES5-only parser. You MUST write ES5-compatible JavaScript only — NO arrow functions, template literals, const/let, destructuring, spread, async/await, classes, or shorthand object methods. Use var, function expressions, string concatenation with '+', and .then() for promises. Modern syntax throws 'expecting ;' errors.",
    {
      code: z.string().describe("ES5-only JavaScript to execute in the Figma plugin context. Use var (not const/let), function(){} (not =>), '+' concatenation (not `${}`), and .then() (not async/await). The figma global is available. Return a value or a Promise."),
      timeout: z.number().optional().describe("Execution timeout in ms. Default: 5000"),
    },
    async (args) => {
      try {
        const result = await connector.executeInPluginContext(args.code, args.timeout ?? 5000);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, "figma_execute failed");
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- Variable CRUD ----

  server.tool(
    "figma_create_variable",
    "Create a new variable in a Figma file. Requires Desktop Bridge plugin.",
    {
      collection_id: z.string().describe("Variable collection ID"),
      name: z.string().describe("Variable name (use / for grouping, e.g. 'colors/primary/500')"),
      resolved_type: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).describe("Variable type"),
      values: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Values by mode ID. e.g. { 'modeId': '#ff0000' }"),
      description: z.string().optional().describe("Variable description"),
      scopes: z.array(z.string()).optional().describe("Variable scopes"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "create_variable",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_update_variable",
    "Update an existing variable's values in a Figma file. Requires Desktop Bridge plugin.",
    {
      variable_id: z.string().describe("Variable ID to update"),
      values: z.record(z.string(), z.unknown()).describe("New values by mode ID"),
      name: z.string().optional().describe("New variable name"),
      description: z.string().optional().describe("New description"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "update_variable",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_delete_variable",
    "Delete a variable from a Figma file. Requires Desktop Bridge plugin.",
    {
      variable_id: z.string().describe("Variable ID to delete"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "delete_variable",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_rename_variable",
    "Rename a variable in a Figma file. Requires Desktop Bridge plugin.",
    {
      variable_id: z.string().describe("Variable ID to rename"),
      new_name: z.string().describe("New variable name"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "rename_variable",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_create_variable_collection",
    "Create a new variable collection in a Figma file. Requires Desktop Bridge plugin.",
    {
      name: z.string().describe("Collection name"),
      initial_mode_name: z.string().optional().describe("Name for the first mode. Default: 'Mode 1'"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "create_variable_collection",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_delete_variable_collection",
    "Delete a variable collection from a Figma file. Requires Desktop Bridge plugin.",
    {
      collection_id: z.string().describe("Collection ID to delete"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "delete_variable_collection",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_add_mode",
    "Add a new mode to a variable collection. Requires Desktop Bridge plugin.",
    {
      collection_id: z.string().describe("Collection ID"),
      mode_name: z.string().describe("Name for the new mode (e.g. 'Dark')"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "add_mode",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_rename_mode",
    "Rename a mode in a variable collection. Requires Desktop Bridge plugin.",
    {
      collection_id: z.string().describe("Collection ID"),
      mode_id: z.string().describe("Mode ID to rename"),
      new_name: z.string().describe("New mode name"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "rename_mode",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- Batch Operations ----

  server.tool(
    "figma_batch_create_variables",
    "Create multiple variables at once (up to 100). Requires Desktop Bridge plugin.",
    {
      collection_id: z.string().describe("Variable collection ID"),
      variables: z
        .array(
          z.object({
            name: z.string(),
            resolved_type: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]),
            values: z.record(z.string(), z.unknown()).optional(),
            description: z.string().optional(),
          })
        )
        .max(100)
        .describe("Array of variables to create (max 100)"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "batch_create_variables",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_batch_update_variables",
    "Update multiple variables at once (up to 100). Requires Desktop Bridge plugin.",
    {
      updates: z
        .array(
          z.object({
            variable_id: z.string(),
            values: z.record(z.string(), z.unknown()).optional(),
            name: z.string().optional(),
            description: z.string().optional(),
          })
        )
        .max(100)
        .describe("Array of variable updates (max 100)"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "batch_update_variables",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_setup_design_tokens",
    "Set up a complete 3-tier token architecture (Primitive → Semantic → Component) with optional dark mode. Creates collections and variables following DTCG format. Requires Desktop Bridge plugin.",
    {
      preset: z
        .enum(["minimal", "standard", "comprehensive"])
        .optional()
        .describe("Token preset level. Default: standard"),
      include_dark_mode: z.boolean().optional().describe("Include dark mode. Default: true"),
      primary_color: z.string().optional().describe("Primary brand color in hex (e.g. '#2563EB'). Default: blue"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "setup_design_tokens",
          payload: {
            preset: args.preset ?? "standard",
            includeDarkMode: args.include_dark_mode ?? true,
            primaryColor: args.primary_color ?? "#2563EB",
          },
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- Node Manipulation ----

  server.tool(
    "figma_resize_node",
    "Resize a node in Figma. Requires Desktop Bridge plugin.",
    {
      node_id: z.string().describe("Node ID to resize"),
      width: z.number().optional().describe("New width in pixels"),
      height: z.number().optional().describe("New height in pixels"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "resize_node",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_move_node",
    "Move a node to a new position in Figma. Requires Desktop Bridge plugin.",
    {
      node_id: z.string().describe("Node ID to move"),
      x: z.number().describe("New X position"),
      y: z.number().describe("New Y position"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "move_node",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_set_fills",
    "Set fill colors on a node in Figma. Requires Desktop Bridge plugin.",
    {
      node_id: z.string().describe("Node ID"),
      fills: z
        .array(
          z.object({
            type: z.string().optional().describe("Fill type. Default: SOLID"),
            color: z
              .object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() })
              .describe("RGBA color (0-1 range)"),
            opacity: z.number().optional(),
          })
        )
        .describe("Array of fills to set"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "set_fills",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_set_strokes",
    "Set strokes on a node in Figma. Requires Desktop Bridge plugin.",
    {
      node_id: z.string().describe("Node ID"),
      strokes: z
        .array(
          z.object({
            type: z.string().optional(),
            color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() }),
          })
        )
        .describe("Array of strokes"),
      stroke_weight: z.number().optional().describe("Stroke weight in pixels"),
      stroke_align: z.enum(["INSIDE", "OUTSIDE", "CENTER"]).optional(),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "set_strokes",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_set_text",
    "Set text content on a text node in Figma. Requires Desktop Bridge plugin.",
    {
      node_id: z.string().describe("Text node ID"),
      text: z.string().describe("New text content"),
      font_family: z.string().optional().describe("Font family name"),
      font_size: z.number().optional().describe("Font size in pixels"),
      font_weight: z.number().optional().describe("Font weight (100-900)"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "set_text",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_clone_node",
    "Clone/duplicate a node in Figma. Requires Desktop Bridge plugin.",
    {
      node_id: z.string().describe("Node ID to clone"),
      offset_x: z.number().optional().describe("X offset from original. Default: 20"),
      offset_y: z.number().optional().describe("Y offset from original. Default: 20"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "clone_node",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_delete_node",
    "Delete a node from the Figma document. Requires Desktop Bridge plugin.",
    {
      node_id: z.string().describe("Node ID to delete"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "delete_node",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_rename_node",
    "Rename a node in Figma. Requires Desktop Bridge plugin.",
    {
      node_id: z.string().describe("Node ID to rename"),
      new_name: z.string().describe("New node name"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "rename_node",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_create_child",
    "Create a child node inside a parent frame/group. Enforces 4px spacing grid. Requires Desktop Bridge plugin.",
    {
      parent_id: z.string().describe("Parent node ID"),
      type: z.enum(["FRAME", "TEXT", "RECTANGLE", "ELLIPSE", "LINE", "COMPONENT"]).describe("Node type to create"),
      name: z.string().optional().describe("Node name"),
      width: z.number().optional().describe("Width in pixels (snapped to 4px grid)"),
      height: z.number().optional().describe("Height in pixels (snapped to 4px grid)"),
      x: z.number().optional().describe("X position"),
      y: z.number().optional().describe("Y position"),
    },
    async (args) => {
      try {
        // Snap dimensions to 4px grid
        const payload = { ...args };
        if (payload.width) payload.width = Math.round(payload.width / 4) * 4;
        if (payload.height) payload.height = Math.round(payload.height / 4) * 4;

        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "create_child",
          payload,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ---- Slot & Component Properties ----

  server.tool(
    "figma_create_slot",
    "Create a slot (content placeholder) on a component with an INSTANCE_SWAP or SLOT property. The slot allows users to swap content when using instances. Requires Desktop Bridge plugin.",
    {
      component_id: z.string().describe("Component ID to add the slot to"),
      slot_name: z.string().describe("Name for the slot (e.g. 'icon-slot', 'content-slot')"),
      property_name: z.string().optional().describe("Display name for the property in Figma UI. Defaults to slot_name"),
      default_value: z.string().optional().describe("Default value for the slot property"),
      width: z.number().optional().describe("Slot width in pixels"),
      height: z.number().optional().describe("Slot height in pixels"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "create_slot",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_add_component_property",
    "Add a component property (BOOLEAN, TEXT, INSTANCE_SWAP, SLOT, VARIANT) to a component. Requires Desktop Bridge plugin.",
    {
      component_id: z.string().describe("Component ID"),
      property_name: z.string().describe("Property name"),
      property_type: z.enum(["BOOLEAN", "TEXT", "INSTANCE_SWAP", "SLOT", "VARIANT"]).describe("Property type"),
      default_value: z.string().optional().describe("Default value (e.g. 'true', 'Button text', '')"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "add_component_property",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_instantiate_component",
    "Create an instance of a component. Requires Desktop Bridge plugin.",
    {
      component_id: z.string().describe("Component ID to instantiate"),
      parent_id: z.string().optional().describe("Parent node to insert into"),
      x: z.number().optional().describe("X position"),
      y: z.number().optional().describe("Y position"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "instantiate_component",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_set_description",
    "Set the description of a component or style. Requires Desktop Bridge plugin.",
    {
      node_id: z.string().describe("Component/style node ID"),
      description: z.string().describe("New description text"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "set_description",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_set_image_fill",
    "Set an image fill on a node using a URL or image hash. Requires Desktop Bridge plugin.",
    {
      node_id: z.string().describe("Node ID"),
      image_url: z.string().optional().describe("Image URL to download and fill"),
      image_hash: z.string().optional().describe("Existing Figma image hash"),
      scale_mode: z.enum(["FILL", "FIT", "CROP", "TILE"]).optional().describe("Image scale mode. Default: FILL"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "set_image_fill",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "figma_arrange_component_set",
    "Auto-arrange variants in a component set into a grid layout. Requires Desktop Bridge plugin.",
    {
      component_set_id: z.string().describe("Component set node ID"),
      spacing: z.number().optional().describe("Spacing between variants in pixels. Default: 40"),
      columns: z.number().optional().describe("Number of columns in grid. Default: auto"),
    },
    async (args) => {
      try {
        const result = await connector.sendCommand({
          id: makeCommandId(),
          type: "arrange_component_set",
          payload: args,
        });
        return { content: [{ type: "text", text: JSON.stringify({ success: true, result }, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
