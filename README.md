# Design Lazyyy — Figma MCP Server

> AI-powered Figma integration with 44 tools for design system analysis, token extraction, accessibility auditing, and read/write operations via natural language.

---

## What is this?

MCP (Model Context Protocol) server that connects AI assistants (Claude Desktop, Claude Code, Cursor, VS Code) to Figma. Ask questions in natural language and get real data from your Figma files — design tokens, components, styles, accessibility scores, and more. With the Desktop Bridge plugin, you can also **write** directly to Figma.

## Key Features

### Read & Analyze
- **Design Tokens** — Extract variables with alias resolution, export as CSS / SCSS / Tailwind / TypeScript / JSON
- **Styles** — Colors, typography, effects with code-ready export
- **Components** — List, search, render as PNG/SVG, generate reconstruction specs
- **Accessibility Audit** — WCAG 2.2 AA checks: contrast, target size, heading hierarchy, spacing grid
- **Design System Scoring** — 6-dimension quality score: hierarchy, consistency, accessibility, usability, responsiveness, performance
- **Token Architecture** — 3-tier validation (Primitive / Semantic / Component)
- **Design-Code Parity** — Compare Figma tokens vs code tokens, get parity score
- **Component Docs** — Auto-generate docs with anatomy, variants, states, ARIA patterns, handoff checklist
- **Comments** — Read, post, delete, with threaded markdown view

### Write & Create (via Desktop Bridge Plugin)
- **Variables** — Full CRUD: create, update, delete, rename, batch operations
- **Token System Setup** — One command to create 3-tier token architecture with dark mode
- **Node Manipulation** — Resize, move, clone, delete, rename, create children
- **Styling** — Set fills, strokes, text, images
- **Components** — Instantiate, set descriptions, arrange variant grids
- **Plugin API** — Execute arbitrary Figma Plugin API JavaScript

### Intelligence (UX/UI Architect)
- **WCAG 2.2 AA** — Contrast 4.5:1 text / 3:1 UI, target size 24px min, heading hierarchy
- **4px Spacing Grid** — Auto-validate and snap spacing values
- **Major Third Type Scale** — 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72px
- **Token Naming** — Validate `{category}.{property}.{variant}-{state}` convention
- **Component Quality Bar** — 8 states, ARIA patterns, keyboard model, handoff checklist

---

## Quick Start

### Step 1: Clone & Install

```bash
git clone https://github.com/plugin87/figma-remote-server.git
cd figma-remote-server
npm install
npm run build
```

### Step 2: Get a Figma Token

1. Go to [Figma](https://www.figma.com) → **Settings** → **Security**
2. Click **Personal Access Tokens** → **Generate new token**
3. Name it anything (e.g. `design-lazyyy`)
4. Copy the token (starts with `figd_...`)

### Step 3: Set up your token

```bash
cp .env.example .env
```

Open `.env` and replace `figd_your_token_here` with your actual token:

```
FIGMA_ACCESS_TOKEN=figd_your_actual_token_here
```

### Step 4: Connect to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "design-lazyyy-figma": {
      "command": "node",
      "args": ["/full/path/to/figma-remote-server/dist/local.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_your_actual_token_here"
      }
    }
  }
}
```

> **Tip**: Replace `/full/path/to/` with the actual path where you cloned the repo.
> To find it, run `pwd` in the project folder.

> **Node version issue?** If you get errors, use the full path to Node 20+:
> `"command": "/Users/yourname/.nvm/versions/node/v20.x.x/bin/node"`

### Step 5: Restart Claude Desktop

Quit Claude Desktop completely (Cmd+Q) and reopen it.

### Step 6: Test it

Open a new chat in Claude Desktop and type:

```
Check Figma status
```

If you see `Connected` with your Figma username — you're all set!

Now try:

```
Get design tokens as CSS from https://www.figma.com/design/xxxxx/MyFile
```

```
Lint accessibility of this file: https://www.figma.com/design/xxxxx/MyApp
```

### Step 7: Enable Write Operations (Optional)

Write tools (create nodes, edit text, manage variables) need the Figma Desktop plugin:

1. Open **Figma Desktop App** (not the browser)
2. Open any Figma file
3. Go to **Main Menu → Plugins → Development → Import plugin from manifest...**
4. Navigate to the cloned repo and select: `design-lazyyy-remote-server/manifest.json`
5. Run the plugin: **Plugins → Development → Design Lazyyy Remote Server**
6. Wait until the plugin window shows **Connected**

Done! Now you can create/edit nodes, variables, and more via Claude.

> See [how-to-use.md](./how-to-use.md) for all 5 connection methods (Claude Desktop, CLI, Cursor, Browser, Cloud)

---

## All 44 Tools

### File & Navigation (5)
| Tool | Description |
|------|-------------|
| `figma_get_status` | Check connection + user info |
| `figma_get_file_data` | Get file document tree |
| `figma_get_file_metadata` | Get file metadata (name, version, counts) |
| `figma_get_file_versions` | Get version history |
| `figma_navigate` | Generate deep link to a node |

### Design Tokens & Styles (2)
| Tool | Description |
|------|-------------|
| `figma_get_variables` | Extract variables with alias resolution + multi-format export |
| `figma_get_styles` | Extract styles with enrichment + code export |

### Components (2)
| Tool | Description |
|------|-------------|
| `figma_get_component` | Get component spec (search by name or ID) |
| `figma_get_component_image` | Render nodes as PNG/SVG/PDF/JPG |

### Comments (3)
| Tool | Description |
|------|-------------|
| `figma_get_comments` | Get all comments (markdown + threaded) |
| `figma_post_comment` | Post a comment |
| `figma_delete_comment` | Delete a comment |

### Design Intelligence (4)
| Tool | Description |
|------|-------------|
| `figma_get_design_system_kit` | Full design system analysis + quality scores |
| `figma_lint_design` | WCAG 2.2 AA accessibility audit |
| `figma_check_design_parity` | Design vs code token comparison |
| `figma_generate_component_doc` | Auto-generate component documentation |

### Write — Variables (11)
| Tool | Description |
|------|-------------|
| `figma_create_variable` | Create a variable |
| `figma_update_variable` | Update variable values |
| `figma_delete_variable` | Delete a variable |
| `figma_rename_variable` | Rename a variable |
| `figma_create_variable_collection` | Create a collection |
| `figma_delete_variable_collection` | Delete a collection |
| `figma_add_mode` | Add a mode (e.g. Dark) |
| `figma_rename_mode` | Rename a mode |
| `figma_batch_create_variables` | Batch create (max 100) |
| `figma_batch_update_variables` | Batch update (max 100) |
| `figma_setup_design_tokens` | Setup 3-tier token architecture |

### Write — Nodes (14)
| Tool | Description |
|------|-------------|
| `figma_execute` | Run arbitrary Plugin API code |
| `figma_resize_node` | Resize a node |
| `figma_move_node` | Move a node |
| `figma_set_fills` | Set fill colors |
| `figma_set_strokes` | Set strokes/borders |
| `figma_set_text` | Set text content + font |
| `figma_set_image_fill` | Set image fill |
| `figma_clone_node` | Duplicate a node |
| `figma_delete_node` | Delete a node |
| `figma_rename_node` | Rename a node |
| `figma_create_child` | Create child node |
| `figma_instantiate_component` | Create component instance |
| `figma_set_description` | Set component description |
| `figma_arrange_component_set` | Auto-arrange variants grid |

### Console (3)
| Tool | Description |
|------|-------------|
| `figma_get_console_logs` | Get plugin console logs |
| `figma_clear_console` | Clear console logs |
| `figma_watch_console` | Watch bridge status + logs |

---

## Export Formats

| Format | Output |
|--------|--------|
| CSS | `--color-primary: #2563EB;` |
| SCSS | `$color-primary: #2563EB;` |
| Tailwind | `{ colors: { primary: "#2563EB" } }` |
| TypeScript | `export const tokens = { ... } as const;` |
| JSON | Raw structured data |

---

## Architecture

```
Claude Desktop / Cursor / VS Code
        │
        │ MCP (stdio)
        ▼
  ┌─────────────────────────────┐
  │  Design Lazyyy MCP Server   │
  │  ┌───────────────────────┐  │
  │  │  44 Tools             │  │
  │  │  Enrichment Engine    │  │
  │  │  Scoring Engine       │  │
  │  │  Figma REST API       │  │
  │  │  LRU Cache            │  │
  │  └───────────────────────┘  │
  │           │                 │
  │    HTTP Bridge :9223        │
  └─────────────────────────────┘
              │
              │ HTTP Polling
              ▼
  ┌─────────────────────────────┐
  │  Figma Desktop Plugin       │
  │  (Design Lazyyy Remote      │
  │   Server)                   │
  │  ┌───────────────────────┐  │
  │  │  Plugin API Access    │  │
  │  │  Variable CRUD        │  │
  │  │  Node Manipulation    │  │
  │  └───────────────────────┘  │
  └─────────────────────────────┘
```

---

## Tech Stack

- **TypeScript** (ES2022, strict mode)
- **@modelcontextprotocol/sdk** — MCP protocol
- **Zod** — Schema validation
- **Pino** — Structured logging (stderr)
- **Node.js HTTP** — Desktop Bridge server

---

## Development

```bash
npm install       # Install dependencies
npm run build     # Build TypeScript
npm run dev       # Watch mode
npm run lint      # Lint with Biome
npm run format    # Format with Biome
```

---

**Built by Design Lazyyy**
