# Brief: Firefox/Safari support and `kanbanmd serve`

Branch: `claude/firefox-folder-support-855ad0` (worktree `board-review-testing-a67bb1`). Nothing committed yet.
Board tasks: TASK-035 (picked folder), TASK-037 (serve), TASK-036 (installer, planned below), TASK-004 (browser storage, parked), TASK-003 (save as folder project, later).

## Why
Firefox and Safari have no `showDirectoryPicker`, so folder mode was Chromium-only. The Mozilla thread (support.mozilla.org/questions/1264779) is about `file://` links and does not help.

## Done
1. **Picked-folder source (read-only).** Without the File System Access API the Folder button opens an `<input webkitdirectory>`. `pickedSource()` (`src/scripts/03a-sources.js`) keeps the folder's own `.md` files, `writable: false`, no polling. Status bar: Read-only / *Pick the folder again* / *Edit with kanbanmd* (copies `kanbanmd serve`). Errors reuse the start-screen notice (no kanban.md, not a board, over 5 MB). Code: `03c-picked-folder.js`, `03b-web-board.js`.
2. **`kanbanmd serve [--port N] [--no-open]`** (`cli/serve.js`, zero dependencies). Serves the bundled page and a file API for one folder on 127.0.0.1 (default port 4777, next free if busy). The page gets `window.KANBANMD_SERVICE` injected and opens through `serviceSource()` (`03a-sources.js`, `03d-service.js`): same polling and merge as the folder source. Status bar: *Served board*, *kanbanmd stopped* when the service goes away, *Session expired* when its key is no longer valid.
3. **Access model.** The printed URL `/?t=<key>` sets an `HttpOnly; SameSite=Strict` cookie (named per port) and redirects without the key. Every request needs the right Host; a browser Origin must match; the API needs the cookie; writes need the `X-Kanbanmd` header. Only `kanban.md`, `archive.md`, the board's backlog file and `*.vN-backup.md` are reachable; 5 MB cap; atomic temp-file + rename; optional `If-Match`. The key lives as long as the process (not one-time).
4. Docs: README line, `docs/getting-started.md` "Firefox and Safari". UX design from the design agent: `drafts/sources-ux.md` (for browser storage, TASK-004, not built).

## Tested
- `npm test`: 307 pass (8 new in `test/serve.test.mjs`: sign-in, no/forged cookie, read/write/ETag, If-Match 412, file whitelist and path tricks, header and 5 MB cap, foreign Host/Origin, port fallback).
- In the built-in browser (Chromium, Firefox simulated by passing synthetic `webkitRelativePath` files): picked folder good/empty/not-a-board, write refused, banner text.
- End to end against a real `kanbanmd serve`: page edit reached `kanban.md`; an agent `note` via the CLI appeared in the page within the poll interval; stopping the service flipped the status bar to stopped, and restarting it (new key) to expired.

## Not done / not checked
- Never run in a real Firefox or Safari (only Chromium with the API removed/simulated).
- Drag-and-drop of a folder onto the page; a hosted-page "connect" opt-in (`--allow-origin`); SSE push instead of 2 s polling.
- `open` of the browser on Linux/Windows untested. Windows `PUT` rename over an open file untested.
- German and Chinese strings for the new keys fall back to English.
- `alert.browserNotSupported` is now unused (left in place).
- A very large folder (node_modules inside) makes Firefox enumerate every file before the page filters; not measured.

## Decisions to review
- Key valid for the process lifetime rather than one use (so the printed URL can be reopened).
- `serve` writes whole files like the Chromium page does (no CLI lock); the page's own merge-before-write covers concurrent agents.
- **Scope stays one folder (decided).** `serve` reaches only the folder it was started in. No `--root` project list and no server-side folder browser: a narrow boundary is easier to explain and to trust. More projects means one `serve` per folder (ports 4777, 4778, ...).
- Board tasks 035 and 037 sit in In Progress, not Done, until you have checked them.

## Direction (updated)
- `kanbanmd serve` is the way to edit in Firefox, Safari and Zen. Browser storage (TASK-004) is **parked** ("Not doing it for now", owner's note). `drafts/sources-ux.md` stays as reference if it returns; its dirty-state and indicator ideas are not on the critical path.
- A gut check in the served page: edits and agent changes show within the usual 2 s change check, same as the folder source. Write speed was not compared.
- Next up: the installer (TASK-036), below.

## Plan: installer (TASK-036)
Goal: agents find and use the tools without hand setup, so they stop hand-editing `kanban.md`.

**1. One package, one name.** Publish a single npm package `kanbanmd` from the repo root.
- `bin`: `kanbanmd` (existing `cli/kanbanmd.js`), with new commands `mcp` (runs the MCP server), `serve` (done), `init`.
- Move `@modelcontextprotocol/sdk` to root `dependencies` (the only runtime dependency, kept on purpose). `kanbanmd mcp` loads the server with a dynamic `import`, so the plain CLI and `serve` start without touching the SDK.
- `private: false`, a `files` whitelist (`cli`, `core`, `io`, `mcp`, built `kanbanmd.html`, the skill folder, the snippet), `prepublishOnly` = build + test. `mcp/package.json` and its lockfile go away or become a thin shim.
- Check the name `kanbanmd` is free on npm before anything else. Publishing needs the owner's npm account; I cannot do it.

**2. `kanbanmd init [--dir .] [--dry-run] [--no-mcp] [--no-skill] [--no-instructions]`.** Offline, idempotent, never destructive:
1. Board: if there is no `kanban.md`, create the default board and archive with the core's `createDefaultBoardContent` (same as the page).
2. MCP config: merge `mcpServers.kanban = { command: "npx", args: ["-y", "kanbanmd", "mcp"] }` into project `.mcp.json` (Claude Code project scope). No `--dir`: the server already defaults to the working directory. Keep every other server. If the file is not valid JSON, stop and say so; never overwrite it.
3. Skill: copy `.claude/skills/markdown-task-manager` into the project (skip files that are already identical; do not overwrite a locally edited skill without `--force`).
4. Instructions: write a short block (use the Kanban MCP tools; else `npx kanbanmd <command>`; never hand-edit `kanban.md`; archive only when asked) between `<!-- kanbanmd:start -->` / `<!-- kanbanmd:end -->` markers in `AGENTS.md`, and in `CLAUDE.md` when it exists. Re-running replaces only the marked block.
5. Print what changed, plus the one-line manual command for clients it does not configure (Cursor, VS Code, Codex use different files; Codex's is global, so init only prints it).

**3. One-liners that result.**
```bash
npx -y kanbanmd init                                   # whole setup
claude mcp add kanban -- npx -y kanbanmd mcp           # MCP only, no files touched
npx -y kanbanmd serve                                  # edit in any browser
```

**4. Tests.**
- `init` in a temp dir: fresh project; second run changes nothing; existing `.mcp.json` with other servers is preserved; malformed JSON aborts with no write; existing `AGENTS.md` text outside the markers is untouched; `--dry-run` writes nothing; locally edited skill is not clobbered.
- Package: `npm pack --dry-run` lists exactly the whitelist; install the packed tarball in a temp dir, run `kanbanmd --help`, `kanbanmd serve` (start, fetch, stop) and an MCP `initialize` + `tools/list` against `kanbanmd mcp`.
- Docs: replace the setup section of `docs/ai-agents.md` and the README with the one-liners.

**5. Risks and open points.**
- `npx -y` adds a download on first start and a short delay at each session start while the package is cached; a global install (`npm i -g kanbanmd`) is the alternative to document.
- A project-scoped `.mcp.json` asks the user to approve the server in Claude Code the first time; say so in the output.
- Whether to add `--agent cursor|vscode` file writers now or only print instructions (recommended: print only for now).
- Version and release flow (tag, changelog) are the owner's call.

## Installer: built (TASK-036), not published
- **Package.** Name `@ashikahmad/kanbanmd` (scoped, owner's choice; the name is read from `package.json` by `init`, so a rename is one edit). `private` removed, `files` whitelist, `engines.node >= 18`, `prepublishOnly` = build + test. The MCP SDK moved to root `dependencies`; `mcp/package.json`, its lockfile and `npm run mcp:install` are gone. Existing MCP tests now use the root `node_modules`.
- **Commands.** `kanbanmd mcp [--read-only]` (loads the server lazily, so other commands never need the SDK), `kanbanmd serve`, and `kanbanmd init`.
- **`init`** (`cli/init.js`): `--agent claude,cursor,vscode,gemini,codex,generic|all`; with no flag it asks on a terminal (Enter = Claude Code) and defaults to `claude` when not interactive. Writes the agent's MCP file, an instruction block between `kanbanmd:start/end` markers, the skill (Claude), and a starter `kanban.md` if none exists. Codex's global config is printed, not written. Idempotent; keeps other servers; never overwrites unparseable JSON, a different `kanban` entry or an edited skill without `--force`; `--dry-run`; `--no-mcp/--no-skill/--no-instructions/--no-board`. Output is one JSON report (actions, manual snippets, next steps).
- **Tests.** `test/init.test.mjs` (12): fresh run, second run unchanged, all agents, merge with existing `.mcp.json`, differing entry, JSON with comments, markers, skill/board protection, dry-run and switches, agent parsing, the CLI itself, and the `npm pack` file list. Suite: 334 pass.
- **Tarball smoke test (done by hand, not in the suite because it needs the network):** packed the tarball, installed it into an empty project, ran `kanbanmd --help`, `init --agent claude,codex`, `board`, `serve` (page and API answered 200 with the session cookie) and an MCP handshake with the installed SDK (14 tools, `get_board` worked).
- **Docs.** `docs/ai-agents.md` (new "Set up the agents" section with the per-agent table), README and readmeFR, `docs/development.md`. They show the `npx -y @ashikahmad/kanbanmd ...` one-liners, which only work after publishing; the clone form (`node cli/kanbanmd.js init`) works now.

## Before publishing (with the owner)
1. Do the repo move (TASK-038) first, then set `repository`, `homepage` and `bugs` in `package.json` to the new repo (not set yet).
2. `npm login` (your account, 2FA), then `npm publish --access public` for a scoped package. I will not run it.
3. After publishing: run the one-liners from a clean folder (`npx -y @ashikahmad/kanbanmd init --dry-run`, then a real run and a `claude mcp add` session) and tick TASK-036.
4. Decide the version (currently 2.0.0, matching the app) and a changelog entry.
5. Check that `npm view @ashikahmad/kanbanmd` shows the right `files` and that the README on the npm page reads well (it is the repo README).

## Menu pass (done in this branch)

- Regrouped the burger menu: **Open** (folder, web address, and on a served page "Back to <folder>"), then this board's tools, then project, then app (language, links). Separators with nothing between them are hidden.
- Wording: `Open folder…` / `Open from a web address…`. On a served page the folder item is `Open another folder…`; in Firefox/Safari it is `Open folder (read-only)…`.
- `Back to <folder>` reopens the served board without a reload (the access cookie is still valid).
- German and Chinese now have the web, picked-folder and service strings (they fell back to English before).
- Decision to review: a served page still offers both open items; the alternative was hiding them.

### Review pass and footer (also in this branch)

- The source banner under the header is replaced by a thin **status bar** (footer, `03e-status-bar.js`). Left: the open source. Away from the served board it also shows a `● Back to served board` chip whose dot and text show the service state (ok, stopped, session expired). It pings the service every 3 s while another source is open. Right: `Synced hh:mm:ss`, updated on each successful check of a writable board.
- Fixed from the code review: `?board=` wins over the served board (so Open from a web address works on a served page); 401/403 is no longer shown as connected; the read-only folder label survives on a served Firefox page; an empty picked folder says so; `t()` keeps `$&` literal; the service key is the full path; board-view setup is one helper; the dead `alert.browserNotSupported` key is gone.
- Not done: the page does not send `If-Match` (needs a per-file version in `write()`); no unit tests for the page-side code (it needs a jsdom-style harness).
- Security review: no high-confidence findings.
- Not checked: real Firefox/Safari; long folder names wrap in the menu.

## Next
1. Your review of picked folder, `serve` and the installer; a real Firefox / Safari / Zen run.
2. Renderer fix for inline `**Label**:` (TASK-033 card), if you want it.
3. TASK-038 (fresh repo), then publish.
4. Optional later: SSE push, `--allow-origin`, drag-and-drop of a folder, German/Chinese strings.
