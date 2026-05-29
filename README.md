# Design Lazyyy — Figma MCP Server

> AI-powered Figma integration with 46 tools for design system analysis, token extraction, accessibility auditing, and read/write operations via natural language.

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/plugin87/figma-remote-server.git
cd figma-remote-server
npm install
npm run build
```

### 2. Get Figma Token

1. Go to [Figma](https://www.figma.com) → **Settings** → **Security**
2. Click **Personal Access Tokens** → **Generate new token**
3. Name: `design-lazyyy`
4. **Scopes** — tick ทุกอัน (Read & Write)
5. Copy token (starts with `figd_...`)

### 3. Config

```bash
cp .env.example .env
```

Open `.env` → paste your token:

```
FIGMA_ACCESS_TOKEN=figd_your_token_here
```

### 4. Connect to Claude Desktop

Edit config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "design-lazyyy-figma": {
      "command": "node",
      "args": ["/full/path/to/figma-remote-server/dist/local.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_your_token_here"
      }
    }
  }
}
```

> **Tip:** Run `pwd` in the project folder to get the full path.

> **Node version issue?** Use the full path to Node 20+:
> ```json
> "command": "/Users/yourname/.nvm/versions/node/v20.x.x/bin/node"
> ```
>
> Find your node path with: `which node`

### 5. Restart Claude Desktop

Quit completely (Cmd+Q) → Reopen.

### 6. Test

Type in Claude Desktop:

```
Check Figma status
```

You should see:
- `status: "connected"` — API works
- `bridge.status: "connected"` — Write operations ready
- `bridge.status: "disconnected"` — Need to open Desktop Bridge plugin (Step 7)

### 7. Enable Write Operations (Optional)

Write tools (create nodes, edit text, manage variables) need the Figma Desktop plugin:

1. Open **Figma Desktop App** (not the browser)
2. Open any file
3. **Menu (≡) → Plugins → Development → Import plugin from manifest...**
4. Select: `figma-remote-server/design-lazyyy-remote-server/manifest.json`
5. Run the plugin: **Plugins → Development → Design Lazyyy Remote Server**
6. Wait until the plugin shows **online** (green)

Done! Now you can create/edit nodes, variables, and more via Claude.

---

## Troubleshooting

### Plugin shows "offline" — can't connect

1. **ใช้ Figma Desktop App** ไม่ใช่ browser version
2. เช็คว่า Claude Desktop เปิดอยู่ (MCP server ต้องรันอยู่)
3. ลองเปิด browser แล้วเข้า `http://localhost:9223/diagnostics`
   - ถ้าเห็น JSON → server ทำงานอยู่ ปิด plugin แล้วเปิดใหม่
   - ถ้า error → Claude Desktop อาจไม่ได้รัน MCP server ลอง restart

### Write tools fail — "Desktop Bridge not connected"

1. Run `Check Figma status` ดู `bridge.status`
2. ถ้า `disconnected`:
   - เปิด Figma Desktop → run Design Lazyyy plugin
   - รอให้ขึ้น **online** (สีเขียว)
3. ถ้า `unavailable`:
   - Port 9223-9232 อาจถูกใช้อยู่
   - ลอง: `lsof -i :9223` เพื่อเช็ค
   - ปิด Claude Desktop ทั้งหมด (Cmd+Q) แล้วเปิดใหม่

### Plugin connects then disconnects

- อาจมี Claude Desktop หลาย instance ทำงานอยู่ → ปิดทั้งหมดแล้วเปิดแค่อันเดียว
- ลอง: `lsof -i :9223-9232` เพื่อเช็ค process ที่ใช้ port

### Command timed out

- Figma อาจไม่ตอบสนอง ลองคลิกในไฟล์ Figma แล้วลองใหม่
- สำหรับ `set_text` ต้องมี font ที่ใช้ติดตั้งอยู่ในเครื่อง

---

## All 44 Tools

### Read & Analyze
| Tool | Description |
|------|-------------|
| `figma_get_status` | Check API + Bridge connection |
| `figma_get_file_data` | Get file document tree |
| `figma_get_file_metadata` | Get file metadata |
| `figma_get_file_versions` | Get version history |
| `figma_navigate` | Generate deep link to node |
| `figma_get_variables` | Extract variables + multi-format export |
| `figma_get_styles` | Extract styles + code export |
| `figma_get_component` | Get component spec |
| `figma_get_component_image` | Render nodes as PNG/SVG/PDF/JPG |
| `figma_get_comments` | Get all comments |
| `figma_post_comment` | Post a comment |
| `figma_delete_comment` | Delete a comment |
| `figma_get_design_system_kit` | Full design system analysis |
| `figma_lint_design` | WCAG 2.2 AA accessibility audit |
| `figma_check_design_parity` | Design vs code token comparison |
| `figma_generate_component_doc` | Auto-generate component docs |

### Write (Desktop Bridge Required)
| Tool | Description |
|------|-------------|
| `figma_execute` | Run arbitrary Plugin API code |
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
| `figma_create_slot` | Create a slot (content placeholder) on component |
| `figma_add_component_property` | Add property (BOOLEAN/TEXT/SLOT/INSTANCE_SWAP/VARIANT) |
| `figma_instantiate_component` | Create component instance |
| `figma_set_description` | Set component description |
| `figma_arrange_component_set` | Auto-arrange variants grid |

### Console (Local Mode)
| Tool | Description |
|------|-------------|
| `figma_get_console_logs` | Get plugin console logs |
| `figma_clear_console` | Clear console logs |
| `figma_watch_console` | Watch bridge status + logs |

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
  │  ┌───────────────────────┐  │
  │  │  Plugin API Access    │  │
  │  │  Variable CRUD        │  │
  │  │  Node Manipulation    │  │
  │  └───────────────────────┘  │
  └─────────────────────────────┘
```

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

## Changelog

### 1.0.1

- **Multi-host bridge** — the Figma plugin now connects to every running MCP server at once (ports 9223–9232) instead of only the first. You can drive the same Figma file from regular Claude Desktop **and** Claude Cowork at the same time; each command's response is routed back to the host that sent it. No port config or manual selection needed.
- **Continuous connection** — self-healing port scan, per-server poll loops with retry, response send retries (5×), global error handlers, and an automatic rescan on wake-from-sleep so the plugin keeps working without dropping.
- **`figma_execute` ES5 guidance** — the tool description now spells out that code is evaluated by an ES5-only parser, so the model emits ES5-compatible JavaScript (no arrow functions, template literals, `const`/`let`, or `async`/`await`) and avoids `expecting ';'` parse errors on complex commands.

### 1.0.0

- Initial release — 46 tools for Figma design system analysis, token extraction, accessibility auditing, and read/write operations via the Desktop Bridge plugin.

---
**Built by Design Lazyyy**
