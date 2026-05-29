---
name: design-lazyyy-figma
description: Use the Design Lazyyy Figma MCP server (this repo) to read and write Figma files via Claude — design-system analysis, token/variable CRUD, node manipulation, accessibility audits, and asset export. Trigger when working with Figma through this MCP's figma_* tools, when figma_execute throws "expecting ;", when write tools report "Desktop Bridge not connected", or when connecting from Claude Desktop / Cowork.
---

# Design Lazyyy — Figma MCP

This repo ships an MCP server exposing **46 `figma_*` tools** plus a Figma Desktop
plugin (the "Desktop Bridge") that runs write operations inside Figma.

## Architecture (read this first)

```
Claude Desktop / Cowork  ──MCP(stdio)──▶  MCP server  ──HTTP :9223–9232──▶  Figma plugin
```

- **Read tools** use the Figma REST API — work as long as `FIGMA_ACCESS_TOKEN` is set.
- **Write tools** push commands over an HTTP bridge to the Figma Desktop plugin.
  They fail unless the plugin is running and **online** (🟢) in the Figma Desktop app.
- The plugin scans ports **9223–9232** and connects to **every** running MCP server
  at once (since v1.0.1), so Claude Desktop and Cowork can drive the same file
  simultaneously. Each command's response routes back to the host that sent it.

## ⚠️ Critical: `figma_execute` is ES5-only

`figma_execute` runs your code via `new Function()` inside the plugin sandbox, which
parses with an **ES5-only** parser. Modern syntax throws `SyntaxError: expecting ';'`.

When writing `code` for `figma_execute`, use **ES5 only**:

| ❌ Don't | ✅ Do |
|---|---|
| `const` / `let` | `var` |
| `() => {}` arrow functions | `function () {}` |
| `` `${x}` `` template literals | `"" + x` |
| `async` / `await` | `.then()` / `.catch()` |
| destructuring, spread, classes, shorthand methods | write them out explicitly |

Return a value or a Promise. The `figma` global is available.

```js
// ✅ correct
var sel = figma.currentPage.selection;
var names = [];
for (var i = 0; i < sel.length; i++) { names.push(sel[i].name); }
return { count: sel.length, names: names };
```

Prefer the dedicated tools (e.g. `figma_set_text`, `figma_create_child`) over
`figma_execute` when one exists — they handle fonts, validation, and errors for you.

## Enabling write operations

Write tools need the Desktop Bridge plugin running:

1. Use the **Figma Desktop App** (not the browser).
2. Open the target file.
3. **Menu (≡) → Plugins → Development → Design Lazyyy Remote Server** (import from
   `design-lazyyy-remote-server/manifest.json` the first time).
4. Wait for the plugin badge to show **online** (🟢) — it will list the connected
   ports, e.g. `PORTS 9223, 9224`.

Check connection anytime with `figma_get_status` → look at `bridge.status`
(`connected` / `disconnected` / `unavailable`).

## Tool groups (46 total)

- **Read & Analyze (16)** — `figma_get_status`, `figma_get_file_data`,
  `figma_get_file_metadata`, `figma_get_file_versions`, `figma_navigate`,
  `figma_get_variables`, `figma_get_styles`, `figma_get_component`,
  `figma_get_component_image`, `figma_get_comments`, `figma_post_comment`,
  `figma_delete_comment`, `figma_get_design_system_kit`, `figma_lint_design`
  (WCAG 2.2 AA), `figma_check_design_parity`, `figma_generate_component_doc`.
- **Write — Desktop Bridge required (27)** — `figma_execute`, variable CRUD
  (`figma_create_variable`, `figma_update_variable`, `figma_delete_variable`,
  `figma_rename_variable`, `figma_create_variable_collection`,
  `figma_delete_variable_collection`, `figma_add_mode`, `figma_rename_mode`,
  `figma_batch_create_variables`, `figma_batch_update_variables`,
  `figma_setup_design_tokens`), node ops (`figma_resize_node`, `figma_move_node`,
  `figma_set_fills`, `figma_set_strokes`, `figma_set_text`, `figma_set_image_fill`,
  `figma_clone_node`, `figma_delete_node`, `figma_rename_node`,
  `figma_create_child`), and component ops (`figma_create_slot`,
  `figma_add_component_property`, `figma_instantiate_component`,
  `figma_set_description`, `figma_arrange_component_set`).
- **Console — local mode (3)** — `figma_get_console_logs`, `figma_clear_console`,
  `figma_watch_console`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `figma_execute` → `expecting ';'` | Rewrite the `code` as ES5 (see table above). |
| Write tool → "Desktop Bridge not connected" | Run the plugin in Figma Desktop, wait for 🟢; verify with `figma_get_status`. |
| Plugin shows "offline" | Use Figma **Desktop** app; ensure the MCP host (Claude Desktop/Cowork) is running; hit `http://localhost:9223/diagnostics`. |
| Command from Cowork does nothing | v1.0.1+ already polls all ports 9223–9232. If on an older plugin, reload it (Plugins → Development → re-run) to pick up multi-host support. |
| `set_text` fails | The font used must be installed locally. |

## Maintainer notes

- Plugin source is loaded directly by Figma — no build step. Files:
  `design-lazyyy-remote-server/ui.html` (UI/bridge polling) and `code.js`
  (plugin main thread, also ES5). Reload via Plugins → Development to apply edits.
- MCP tool definitions live in `src/core/tools/*.ts`; run `npm run build` after edits.
- Version string lives in `package.json`, `src/local.ts` (×2), and the plugin UI
  footer in `ui.html` — keep them in sync.
