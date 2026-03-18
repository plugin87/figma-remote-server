# Design Lazyyy — Figma MCP Server

## How to Use

---

## Prerequisites

- **Node.js** v18+ (v20+ recommended)
- **Figma Desktop App** (for write operations)
- **Claude Desktop** or **Claude Code** or other MCP clients
- **Figma Personal Access Token**

---

## 1. Create a Figma Access Token

1. Open [Figma](https://www.figma.com) → **Settings** → **Security**
2. Go to **Personal Access Tokens** → **Generate new token**
3. Name it, e.g. `design-lazyyy`
4. Set permissions:
   - **File content** — Read
   - **Variables** — Read/Write
   - **Comments** — Read/Write
5. Copy the token and save it (it will only be shown once)

---

## 2. Configure the MCP Client

There are **5 ways** to connect to the Design Lazyyy MCP server. Choose the one that fits your workflow.

---

### Method 1: Claude Desktop (Recommended)

The easiest way. Runs locally on your machine.

1. Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "design-lazyyy-figma": {
      "command": "node",
      "args": ["/path/to/figma-console-mcp/dist/local.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_xxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

> **Note**: If Claude Desktop uses an old Node version (< 18), specify the full path:
> `"command": "/Users/yourname/.nvm/versions/node/v20.19.0/bin/node"`

2. Restart Claude Desktop
3. Open a new chat and type: `Check Figma status`

---

### Method 2: Claude Code (CLI)

For developers who prefer the terminal.

```bash
claude mcp add design-lazyyy-figma \
  -e FIGMA_ACCESS_TOKEN="figd_xxxxxxxxxxxxxxxxxx" \
  -- node /path/to/figma-console-mcp/dist/local.js
```

Or if you have a `.env` file in the project, just:

```bash
cd /path/to/figma-console-mcp
claude mcp add design-lazyyy-figma -- node dist/local.js
```

Start a new conversation and test:

```
Check Figma status
```

---

### Method 3: Cursor / VS Code

Add to your editor's MCP settings (usually in `.cursor/mcp.json` or VS Code settings):

```json
{
  "mcpServers": {
    "design-lazyyy-figma": {
      "command": "node",
      "args": ["/path/to/figma-console-mcp/dist/local.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_xxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Restart the editor after saving.

---

### Method 4: Claude.ai (Browser) via Tunnel

Claude.ai runs on Anthropic's cloud, so it can't reach `localhost` directly. Use a tunnel to expose your local server.

**Option A: ngrok**

```bash
# Install ngrok (one time)
brew install ngrok

# Start the MCP server
FIGMA_ACCESS_TOKEN=figd_xxx node /path/to/figma-console-mcp/dist/local.js &

# Expose port 9223 (the HTTP bridge port)
ngrok http 9223
```

You'll get a URL like `https://abc123.ngrok.io` — add this to Claude.ai → Settings → Integrations.

**Option B: Cloudflare Tunnel**

```bash
# Install cloudflared (one time)
brew install cloudflared

# Start the MCP server
FIGMA_ACCESS_TOKEN=figd_xxx node /path/to/figma-console-mcp/dist/local.js &

# Expose port 9223
cloudflared tunnel --url http://localhost:9223
```

You'll get a URL like `https://xxx.trycloudflare.com` — add this to Claude.ai Integrations.

> **Note**: The tunnel only exposes the Desktop Bridge HTTP port. For full MCP protocol support over the browser, the cloud deployment (Method 5) is recommended.

---

### Method 5: Cloud Deployment (Cloudflare Workers)

For permanent cloud access without tunnels. Supports OAuth so multiple users can connect.

1. Install wrangler:

```bash
npm install -g wrangler
wrangler login
```

2. Set up secrets:

```bash
wrangler secret put FIGMA_CLIENT_ID
wrangler secret put FIGMA_CLIENT_SECRET
wrangler secret put SESSION_SECRET
```

3. Deploy:

```bash
wrangler deploy
```

The server will be available at `https://design-lazyyy-figma.workers.dev`.

> **Note**: Cloud mode requires a Figma OAuth app. Create one at [figma.com/developers](https://www.figma.com/developers) → Create app.

---

### Comparison

| Method | Setup | Internet Required | Write Ops | Best For |
|--------|-------|:-:|:-:|---------|
| Claude Desktop | Easy | No | Yes (with plugin) | Daily use |
| Claude Code | Easy | No | Yes (with plugin) | Terminal users |
| Cursor / VS Code | Easy | No | Yes (with plugin) | Coding workflows |
| Claude.ai + Tunnel | Medium | Yes | Yes (with plugin) | Browser access |
| Cloud (Workers) | Advanced | Yes | Yes (via relay) | Team / multi-user |

---

## 3. Set Up the Desktop Bridge Plugin (for Write Operations)

Write tools (create/edit nodes, variables, text, etc.) require installing the Figma plugin:

1. Open the **Figma Desktop App** (not the browser)
2. Open any Figma file
3. Go to **Main Menu → Plugins → Development → Import plugin from manifest...**
4. Select the file: `/Users/plugin87/figma-console-mcp/design-lazyyy-remote-server/manifest.json`
5. Run the plugin: **Plugins → Development → Design Lazyyy Remote Server**
6. Wait until the plugin window shows **Connected**

> The plugin will auto-reconnect when the server restarts.

---

## 4. Test the Setup

Open Claude Desktop and type:

```
Check Figma status
```

If it responds with `Connected — Thientan (Design)` = ready to use.

---

## 5. Example Commands

### Read Operations (no plugin installation required)

#### View File Information
```
View file information: https://www.figma.com/design/xxxxx/MyFile
```

#### Extract Design Tokens as CSS
```
Extract design tokens from this file as CSS: https://www.figma.com/design/xxxxx/MyDesignSystem
```

#### Extract Styles as Tailwind Config
```
Extract styles from this file as Tailwind: https://www.figma.com/design/xxxxx/MyDesignSystem
```

#### View All Components
```
View all components in this file: https://www.figma.com/design/xxxxx/MyFile
```

#### Render Component as SVG
```
Render component node 1:23 as SVG from this file: https://www.figma.com/design/xxxxx/MyFile
```

#### View Comments
```
View all comments in this file: https://www.figma.com/design/xxxxx/MyFile
```

#### Lint Accessibility (WCAG 2.2)
```
Check accessibility of this file: https://www.figma.com/design/xxxxx/MyApp
```

#### Analyze Design System
```
Analyze and score the design system: https://www.figma.com/design/xxxxx/MyDesignSystem
```

#### Generate Component Documentation
```
Generate component doc for node 1:23: https://www.figma.com/design/xxxxx/Components
```

#### Check Design-Code Parity
```
Compare design with code for node 5:67: https://www.figma.com/design/xxxxx/MyFile
```

#### View Version History
```
View version history of this file: https://www.figma.com/design/xxxxx/MyFile
```

---

### Write Operations (plugin must be installed and running)

#### Create a Design Token System
```
Create a 3-tier design token system with dark mode
```

#### Create a Variable
```
Create a variable named colors/primary/500 with color #2563EB
```

#### Edit Text
```
Change the text in node 1:23 to "Hello World"
```

#### Change Color
```
Change the background color of node 5:67 to #FF6B6B
```

#### Clone Node
```
Clone node 1:23 and place it next to the original
```

#### Create a New Frame
```
Create a Frame sized 320x480 named "Mobile Screen" in node 0:1
```

#### Instantiate Component
```
Create an instance of component 308:659
```

#### Batch Create Variables
```
Create 10 color variables: primary/50 through primary/900
```

#### Run Plugin API Code
```
Run code: figma.currentPage.selection
```

---

## 6. Full Tool List (44 tools)

### Read Tools (19 tools) — usable immediately, no plugin required

| Tool | Description |
|------|-------------|
| `figma_get_status` | Check connection status + user info |
| `figma_get_file_data` | Fetch file data + document tree |
| `figma_get_file_metadata` | Fetch metadata (name, version, component count) |
| `figma_get_file_versions` | View file version history |
| `figma_navigate` | Generate a URL to a specific node |
| `figma_get_variables` | Fetch variables/tokens with export to CSS/SCSS/Tailwind/TS/JSON |
| `figma_get_styles` | Fetch styles (colors, text, effects) with export to CSS/SCSS/JSON |
| `figma_get_component` | View component metadata + reconstruction spec |
| `figma_get_component_image` | Render component as PNG/SVG/PDF/JPG |
| `figma_get_comments` | View comments (supports markdown + threaded replies) |
| `figma_post_comment` | Post a comment in Figma |
| `figma_delete_comment` | Delete a comment |
| `figma_get_design_system_kit` | Analyze design system + score across 6 dimensions |
| `figma_lint_design` | Lint accessibility (WCAG 2.2 AA) + spacing + token usage |
| `figma_check_design_parity` | Compare design vs code tokens |
| `figma_generate_component_doc` | Generate complete component documentation (anatomy, variants, states, ARIA) |
| `figma_get_console_logs` | View console logs from the plugin |
| `figma_clear_console` | Clear console logs |
| `figma_watch_console` | View bridge status + recent logs |

### Write Tools (25 tools) — Desktop Bridge Plugin must be running

| Tool | Description |
|------|-------------|
| `figma_execute` | Run Plugin API JavaScript code directly |
| `figma_create_variable` | Create a new variable |
| `figma_update_variable` | Update a variable |
| `figma_delete_variable` | Delete a variable |
| `figma_rename_variable` | Rename a variable |
| `figma_create_variable_collection` | Create a variable collection |
| `figma_delete_variable_collection` | Delete a variable collection |
| `figma_add_mode` | Add a mode (e.g. Dark) |
| `figma_rename_mode` | Rename a mode |
| `figma_batch_create_variables` | Create multiple variables at once (max 100) |
| `figma_batch_update_variables` | Update multiple variables at once (max 100) |
| `figma_setup_design_tokens` | Automatically create a 3-tier token architecture + dark mode |
| `figma_resize_node` | Resize a node |
| `figma_move_node` | Move a node's position |
| `figma_set_fills` | Set background color |
| `figma_set_strokes` | Set stroke/border |
| `figma_set_text` | Edit text + font |
| `figma_set_image_fill` | Set an image fill |
| `figma_clone_node` | Clone/duplicate a node |
| `figma_delete_node` | Delete a node |
| `figma_rename_node` | Rename a node |
| `figma_create_child` | Create a child node (Frame, Text, Rectangle, etc.) |
| `figma_instantiate_component` | Create an instance from a component |
| `figma_set_description` | Set a component's description |
| `figma_arrange_component_set` | Arrange variants into a grid |

---

## 7. UX/UI Intelligence

The server has built-in design intelligence:

### Token Architecture (3-Tier)
```
Primitive (raw values)     → blue/500 = #2563EB
    ↓
Semantic (purpose-based)   → action/primary = {blue/500}
    ↓
Component (scoped)         → button/primary/bg = {action/primary}
```

### Accessibility Checks (WCAG 2.2 AA)
- Contrast ratio: 4.5:1 text, 3:1 UI components
- Target size: 24x24px minimum
- Heading hierarchy
- Color-only indicators
- Focus visibility

### Design System Scoring (6 Dimensions)
| Dimension | Weight |
|-----------|--------|
| Visual Hierarchy | 20% |
| Consistency | 20% |
| Accessibility | 20% |
| Usability | 20% |
| Responsiveness | 10% |
| Performance | 10% |

### Spacing Grid
- 4px base unit
- Auto-validate spacing values

### Typography Scale
- Major Third (1.25): 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72

---

## 8. Export Formats

Variables and Styles can be exported in multiple formats:

| Format | Example |
|--------|---------|
| `css` | `--color-primary: #2563EB;` |
| `scss` | `$color-primary: #2563EB;` |
| `tailwind` | `{ colors: { primary: "#2563EB" } }` |
| `typescript` | `export const tokens = { "color-primary": "#2563EB" } as const;` |
| `json` | `{ "name": "color/primary", "resolvedType": "COLOR", ... }` |

---

## 9. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FIGMA_ACCESS_TOKEN` | **(required)** | Figma Personal Access Token |
| `FIGMA_API_BASE` | `https://api.figma.com` | Figma API base URL |
| `LOG_LEVEL` | `info` | Log level: debug, info, warn, error |
| `CACHE_MAX_SIZE` | `10` | Number of cached API responses |
| `CACHE_TTL_MS` | `300000` | Cache expiration time (5 minutes) |
| `WS_PORT_START` | `9223` | Desktop Bridge port range start |
| `WS_PORT_END` | `9232` | Desktop Bridge port range end |

---

## 10. Troubleshooting

### Server won't start
- Check that `FIGMA_ACCESS_TOKEN` is set
- Check that you're using Node v18+ (`node --version`)
- View log: `~/Library/Logs/Claude/mcp-server-design-lazyyy-figma.log`

### Plugin won't connect
- Claude Desktop must be open first (the server runs through Claude Desktop)
- Check if the plugin shows "Scanning..." or any error
- Try restarting Claude Desktop and running the plugin again

### Tool result too large (1MB limit)
- Use `depth: 1` or `depth: 2` to reduce response size
- Specify a `node_id` for a specific node instead of fetching the entire file

### Variables API not working
- The Variables REST API requires a Figma **Enterprise** plan
- Without Enterprise, it will fall back to file-level styles instead

### Write tools error "No Desktop Bridge connected"
- Figma Desktop must be open with the plugin running
- Check that the plugin shows "Connected" + port number

---

## 11. Build & Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Lint
npm run lint

# Format
npm run format
```

---

## 12. Project Structure

```
figma-console-mcp/
├── src/
│   ├── local.ts                          # Entry point (stdio)
│   ├── index.ts                          # Cloud entry (Cloudflare Workers)
│   ├── core/
│   │   ├── config.ts                     # Environment config
│   │   ├── logger.ts                     # Pino logger (stderr)
│   │   ├── figma-api.ts                  # Figma REST API client
│   │   ├── cache.ts                      # LRU cache
│   │   ├── url-parser.ts                 # Figma URL parser
│   │   ├── response-utils.ts             # Adaptive compression
│   │   ├── types/
│   │   │   ├── config.ts
│   │   │   ├── figma-api.ts              # Figma API response types
│   │   │   └── tools.ts                  # Tool input schemas (Zod)
│   │   ├── tools/
│   │   │   ├── index.ts                  # Tool registration orchestrator
│   │   │   ├── file-tools.ts             # File read tools (5)
│   │   │   ├── variable-tools.ts         # Variable extraction (1)
│   │   │   ├── style-tools.ts            # Style extraction (1)
│   │   │   ├── component-tools.ts        # Component tools (2)
│   │   │   ├── comment-tools.ts          # Comment CRUD (3)
│   │   │   ├── design-system-tools.ts    # Design system analysis (1)
│   │   │   ├── lint-tools.ts             # Accessibility lint (1)
│   │   │   ├── design-code-tools.ts      # Design-code parity (2)
│   │   │   ├── write-tools.ts            # Write operations (25)
│   │   │   └── console-tools.ts          # Console monitoring (3)
│   │   ├── enrichment/
│   │   │   ├── style-resolver.ts         # Token/color/typography resolution
│   │   │   ├── relationship-mapper.ts    # Component-style dependency graph
│   │   │   └── enrichment-service.ts     # Orchestration facade
│   │   └── scoring/
│   │       ├── accessibility.ts          # WCAG 2.2 scoring
│   │       ├── consistency.ts            # Token usage consistency
│   │       └── token-architecture.ts     # 3-tier token validation
│   └── connectors/
│       ├── websocket-server.ts           # HTTP bridge server
│       └── figma-connector.ts            # Connector abstraction
├── design-lazyyy-remote-server/          # Figma plugin
│   ├── manifest.json
│   ├── code.js                           # Plugin sandbox code
│   └── ui.html                           # Plugin UI (HTTP polling)
├── package.json
├── tsconfig.json
└── biome.json
```

---

**Built by Design Lazyyy**
